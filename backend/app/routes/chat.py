from fastapi import APIRouter, Request
from pydantic import BaseModel

from ..rag.report import answer_question
from .events import _get_rag

router = APIRouter()


class ChatRequest(BaseModel):
    question: str


@router.post("/chat")
def chat(req: ChatRequest, request: Request):
    store, llm = _get_rag(request)
    return answer_question(req.question, store, llm)
