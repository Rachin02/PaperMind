from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Annotated, List
from Assistant.assistant import ask_to_llm
from Assistant.rag import add_to_astra
from Assistant.rag import clear_user_history
import tempfile
import os

class Input(BaseModel):
    input: Annotated[str, Field(description="Ask anything to the AI assistant")]
    user_id: Annotated[str, Field(description="Unique user ID")]



app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "AI research Assistant"}


@app.post("/ask")
def user_input(user_input: Input):
    response = ask_to_llm(user_input.input,  user_input.user_id)

    return  JSONResponse(status_code= 200, content = {"response":response})



# when the user click the new conversation buutton
@app.delete("/delete_user_data")
def clear_history(user_id:str):

    return clear_user_history(user_id)


# when the user leave the page
@app.post("/cleanup")
def cleanup_user(user_id: str = Form(...)):
    return clear_user_history(user_id)
        


@app.post("/upload")
async def upload_files(files: List[UploadFile] = File(...), user_id: str = Form(...)):

    print("User ID:", user_id)
    for file in files:

        print("Received:", file.filename)
        print("Content type:", file.content_type)


        with tempfile.NamedTemporaryFile( delete=False, suffix=".pdf" ) as temp:

            content = await file.read()
            temp.write(content)
            temp_path = temp.name

        print("Temporary file:", temp_path)

        try:
            splits = add_to_astra(temp_path, user_id)
            print( f"{file.filename}: " f"{len(splits)} chunks created" )

        finally:

            os.remove(temp_path)
            print("Temporary file deleted:", temp_path)

    return {
        "message": "Files uploaded and processed successfully",
        "files": [file.filename for file in files]
    }