import logging
from typing import List, Dict
from transformers import pipeline
from .base import BaseTopicModel

logger = logging.getLogger(__name__)

class ZeroShotTopicModel(BaseTopicModel):
    """Zero‑shot classification using XLM‑RoBERTa (multilingual)."""
    
    _instance = None
    _pipeline = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    @property
    def name(self) -> str:
        return "xlm-roberta-large-xnli"
    
    def _get_pipeline(self):
        if self._pipeline is None:
            logger.info("Loading zero‑shot classification model...")
            self._pipeline = pipeline(
                "zero-shot-classification",
                 model="vicgalle/xlm-roberta-large-xnli-anli", 
                device=-1  # CPU; change to device=0 for GPU
            )
            logger.info("Zero‑shot model loaded.")
        return self._pipeline
    
    def suggest(self, text: str, candidate_topics: List[str]) -> List[Dict[str, float]]:
        pipe = self._get_pipeline()
        result = pipe(text, candidate_topics)
        # result: {'labels': [...], 'scores': [...]}
        top = [{"topic": result["labels"][i], "confidence": result["scores"][i]}
               for i in range(len(result["labels"]))]
        return top