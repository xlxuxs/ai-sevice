from abc import ABC, abstractmethod
from typing import List, Dict

class BaseTopicModel(ABC):
    """Abstract base class for topic suggestion models."""
    
    @property
    @abstractmethod
    def name(self) -> str:
        pass
    
    @abstractmethod
    def suggest(self, text: str, candidate_topics: List[str]) -> List[Dict[str, float]]:
        """
        Returns list of dicts: [{"topic": str, "confidence": float}, ...]
        Ordered by confidence descending.
        """
        pass