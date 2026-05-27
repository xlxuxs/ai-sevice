from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
from typing import Dict, Tuple
import os

from app.config.languages import SENTIMENT_MODELS

class SentimentModel:
    def __init__(self):
        self.models: Dict[str, torch.nn.Module] = {}
        self.tokenizers: Dict[str, AutoTokenizer] = {}
        self.config = SENTIMENT_MODELS
        
    def _load_model(self, language: str):
        """Lazy load model for a specific language"""
        if language in self.models:
            return
            
        if language not in self.config:
            language = "en"  # fallback to English
            
        model_name = self.config[language]["model"]
        print(f"Loading sentiment model for {language} from {model_name}...")
        
        self.tokenizers[language] = AutoTokenizer.from_pretrained(model_name)
        self.models[language] = AutoModelForSequenceClassification.from_pretrained(model_name)
        print(f"Loaded {language} model")
        
    def analyze(self, text: str, language: str = None) -> Tuple[str, float]:
        """
        Analyze sentiment of text.
        Args:
            text: The input text
            language: Optional language code (am, om, ti, en). If None, auto-detect.
        Returns:
            (sentiment_label, confidence)
        """
        # If language not provided, we'll detect it later (outside this class)
        # For now, we require language to be specified.
        if language is None:
            raise ValueError("Language must be provided or detected before calling analyze")
        
        # Normalize language code (e.g., 'amh' -> 'am')
        lang_map = {
            "amh": "am", "am": "am",
            "orm": "om", "om": "om",
            "tir": "ti", "ti": "ti",
            "eng": "en", "en": "en"
        }
        lang = lang_map.get(language, "en")
        
        self._load_model(lang)
        
        tokenizer = self.tokenizers[lang]
        model = self.models[lang]
        
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
        with torch.no_grad():
            outputs = model(**inputs)
            probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
            prediction = torch.argmax(probs, dim=-1).item()
            confidence = probs[0][prediction].item()
        
        label_map = self.config[lang]["labels"]
        return label_map[prediction], confidence