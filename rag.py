import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def create_vectorstore(pdf_paths: list, conversation_id: int):
    docs = []
    for path in pdf_paths:
        loader = PyPDFLoader(path)
        docs.extend(loader.load())

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    split_docs = splitter.split_documents(docs)

    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    vectorstore = FAISS.from_documents(split_docs, embeddings)

    store_path = os.path.join(UPLOAD_DIR, f"vector_{conversation_id}")
    vectorstore.save_local(store_path)
    return store_path


def get_relevant_context(query: str, vector_path: str):
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    db = FAISS.load_local(vector_path, embeddings, allow_dangerous_deserialization=True)
    results = db.similarity_search(query, k=3)
    return "\n\n".join([r.page_content for r in results])
