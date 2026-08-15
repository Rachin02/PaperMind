from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_astradb import AstraDBVectorStore
from dotenv import load_dotenv
import os
load_dotenv()

embedding = OpenAIEmbeddings(model = "text-embedding-3-large")
astradb_token = os.getenv("ASTRA_DB_APPLICATION_TOKEN")
astradb_endpoint = os.getenv("ASTRA_DB_API_ENDPOINT")

db = AstraDBVectorStore(
        embedding= embedding,
        collection_name= "PaperMind",
        token = astradb_token,
        api_endpoint =  astradb_endpoint )

def add_to_astra(file_path: str, user_id: str):

    loader = PyPDFLoader(file_path)
    docs = loader.load()
    text_splitter = RecursiveCharacterTextSplitter( chunk_size=1000, chunk_overlap=200)
    splits = text_splitter.split_documents(docs)
    for doc in splits:
        doc.metadata["user_id"] = user_id

    print("Chunks created:", len(splits))

    db.add_documents(splits)
    
    return splits


def clear_user_history(user_id:str):
   try:
       deleted = db.delete_by_metadata_filter({"user_id":user_id})
       return f"Deleted {deleted} documents for user {user_id}"
   
   except Exception as e:
       return str(e)