from abc import ABC, abstractmethod
from typing import List

class BaseKeywordModel(ABC):
    """Abstract base class for all keyword extraction models."""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Return the model's identifier."""
        pass
    
    @abstractmethod
    def extract(self, text: str, language: str = 'en', top_n: int = 5) -> List[str]:
        """
        Extract keywords from the given text.
        Args:
            text: Input text
            language: Language code (e.g., 'am', 'om', 'ti', 'en')
            top_n: Number of keywords to return
        Returns:
            List of keyword strings
        """
        pass