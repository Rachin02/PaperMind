from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from Assistant.rag import db
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_classic.chains.retrieval import create_retrieval_chain
from langchain_classic.chains import create_history_aware_retriever
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.runnables import RunnableWithMessageHistory

load_dotenv()

store = {}

def get_session_history(user_id:str) -> BaseChatMessageHistory:
    if user_id not in store:
        store[user_id] = ChatMessageHistory()

    return store[user_id]


contextualize_q_system_prompt = """
Given a chat history and the latest user question, which might
reference context in the chat history, formulate a standalone
question which can be understood without the chat history.

Do not answer the question.
Only reformulate the question if necessary.
Otherwise return it as is.
"""

system_prompt = """
You are PaperMind, an AI research assistant that helps users understand,
analyze, compare, and discuss academic research papers.

Use the retrieved research-paper context and conversation history to answer
the user's question accurately and clearly.

Your capabilities include:
- Summarizing papers or specific sections
- Explaining technical concepts, models, algorithms, equations, and terminology
- Analyzing methodology, datasets, preprocessing, models, and experimental setup
- Extracting results, metrics, findings, and comparisons
- Identifying limitations and weaknesses
- Comparing multiple research papers
- Answering follow-up questions and maintaining conversational context
- Explaining research concepts in either simple or technical language depending
  on the user's question

IMPORTANT RULES:

1. Ground your answers in the retrieved context when the question is about
   the uploaded papers.

2. Never invent information, results, statistics, citations, datasets,
   methodology details, or claims.

3. If the retrieved context does not contain enough information to answer
   the question, clearly say that the information could not be found in
   the uploaded papers.

4. Distinguish between:
   - What the authors explicitly reported
   - Your interpretation or explanation

5. Preserve numerical values, percentages, dataset sizes, and evaluation
   metrics accurately.

6. When comparing papers, do not mix information between papers. Clearly
   identify which paper each finding belongs to.

7. For limitations, distinguish between limitations explicitly stated by the
   authors and limitations that you infer from the paper.

8. Adapt the response to the user's request:
   - Use concise answers for simple questions.
   - Use structured explanations for complex questions.
   - Use bullet points or tables when they improve clarity.
   - Do not make every answer unnecessarily long.

9. Use conversation history to understand follow-up questions such as
   "What dataset did they use?", "How large is it?", or "What about their
   second experiment?"

10. Do not reveal your internal reasoning or retrieval process unless
    explicitly asked.

Retrieved research-paper context:
{context}

Answer the user's question directly, accurately, and clearly. also make proper structure of your output answer. so that user can easily read the answer
"""



llm = ChatOpenAI(model = "gpt-5-nano")
embedding = OpenAIEmbeddings(model = "text-embedding-3-large")


def ask_to_llm(user_input:str, user_id:str):

    retriever = db.as_retriever(
        search_kwargs = {"k":10,
                         "filter":{"user_id": user_id}
                         }
    )

    contextualize_q_prompt = ChatPromptTemplate.from_messages(
        [
            ("system", contextualize_q_system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}")
        ]
    )
    history_aware_retriever = create_history_aware_retriever( llm, retriever, contextualize_q_prompt )

    prompt = ChatPromptTemplate.from_messages([
              ("system", system_prompt),
              MessagesPlaceholder("chat_history"),
             ("user", "{input}")
    ])

    question_answering_chain = create_stuff_documents_chain(llm, prompt)
    llm_chain = create_retrieval_chain(history_aware_retriever, question_answering_chain)


    conversational_rag_chain = RunnableWithMessageHistory(
        llm_chain,
        get_session_history,
        input_messages_key= "input",
        history_messages_key= "chat_history",
        output_messages_key= "answer"
    )

    response = conversational_rag_chain.invoke(
        {"input":user_input},
        config = {"configurable": {"session_id": user_id}}
        )
    return response['answer']

