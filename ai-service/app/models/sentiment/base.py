from abc import ABC, abstractmethod

class BaseModel(ABC):
    """All models must implement this interface."""
    
    @abstractmethod
    def predict(self, text: str, language: str = None) -> tuple[str, float]:
        """
        Return (label, confidence).
        Label should be one of: positive, negative, neutral.
        """
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Unique identifier for the model."""
        pass
    
    @property
    def languages(self) -> list[str]:
        """List of language codes this model supports (optional)."""
        return []