from fastapi import FastAPI, UploadFile, Form, File
from fastapi.responses import StreamingResponse
from database import Base, engine, SessionLocal
from models import Conversation, Message
from groq_client import generate_stream
from rag import create_vectorstore, get_relevant_context
import shutil, os

Base.metadata.create_all(bind=engine)
app = FastAPI(title="StudyBuddy RAG API")

from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv
load_dotenv()


# Add this block
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # your frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/create")
async def create_conversation(
    title: str = Form(...),
    subject: str = Form(...),
    files: list[UploadFile] = File(None)
):
    """
    Create a new conversation.
    User can upload 0–5 PDF files (optional).
    """
    db = SessionLocal()
    conv = Conversation(title=title, subject=subject)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    conversation_id = conv.id
    vector_path = None
    if files:
        file_paths = []
        for f in files[:5]:
            path = f"uploads/{conv.id}_{f.filename}"
            with open(path, "wb") as buffer:
                shutil.copyfileobj(f.file, buffer)
            file_paths.append(path)

        vector_path = create_vectorstore(file_paths, conversation_id)
        conv.vector_path = vector_path
        db.commit()

    db.close()
    return {
        "conversation_id": conversation_id,
        "vector_path": vector_path or "No PDFs uploaded"
    }


@app.get("/{conversation_id}/get")
async def get_answer(conversation_id: int, query: str):

    db = SessionLocal()
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        db.close()
        return {"error": "Conversation not found"}

    messages = db.query(Message).filter(Message.conversation_id == conversation_id).all()
    history = [{"role": m.role, "content": m.content} for m in messages]

    context = ""
    if conv.vector_path:
        context = get_relevant_context(query, conv.vector_path)

    final_prompt = f"""
You are StudyHelper AI, a friendly and knowledgeable tutor chatbot helping students understand their subject.

Subject: {conv.subject}

Context from documents (if available):
{context}

Chat history and student question:
{query}
"""

   
    user_msg = Message(conversation_id=conversation_id, role="user", content=query)
    db.add(user_msg)
    db.commit()

    async def stream():
        ai_response = ""
        for token in generate_stream(final_prompt, history):
            ai_response += token
            yield token

        msg = Message(conversation_id=conversation_id, role="assistant", content=ai_response)
        db.add(msg)
        db.commit()
        db.close()

    return StreamingResponse(stream(), media_type="text/plain")


@app.delete("/{conversation_id}/delete")
def delete_conversation(conversation_id: int):
    """
    Delete a conversation and its messages.
    """
    db = SessionLocal()
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conv:
        db.delete(conv)
        db.commit()
    db.close()
    return {"status": "deleted"}


@app.get("/history/{conversation_id}")
def get_history(conversation_id: int):
    """
    Get the full chat history for a conversation.
    Includes conversation title, subject, and messages.
    """
    db = SessionLocal()
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()

    if not conv:
        db.close()
        return {"error": "Conversation not found"}

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.id.asc())
        .all()
    )

    formatted = [
        {"role": msg.role, "content": msg.content, "message_id": msg.id}
        for msg in messages
    ]

    db.close()

    return {
        "conversation_id": conv.id,
        "title": conv.title,
        "subject": conv.subject,
        "messages": formatted,
    }

#get history of a conversations with messages
@app.get("/historys/")
def get_all_conversations():
    """
    Get a list of all conversations with their IDs, titles, and subjects.
    """
    db = SessionLocal()
    conversations = db.query(Conversation).all()
    result = [
        {"conversation_id": conv.id, "title": conv.title, "subject": conv.subject}
        for conv in conversations
    ]
    db.close()
    return result