import fasttext
import os
import logging
from huggingface_hub import hf_hub_download

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global model instance (lazy loaded)
_fasttext_model = None

# Mapping from fastText 3-letter codes to our 2-letter codes
LANG_MAP = {
    # Oromo variants (macrolanguage orm and its dialects)
    'orm': 'om',   # Oromo macrolanguage
    'gaz': 'om',   # West Central Oromo
    'gax': 'om',   # Borana-Arsi-Guji Oromo
    'hae': 'om',   # Eastern Oromo
    
    # Other Ethiopian languages
    'amh': 'am',   # Amharic
    'tir': 'ti',   # Tigrinya
    
    # English
    'eng': 'en',   # English
}
def _load_fasttext_model():
    """Download and load the fastText language identification model."""
    global _fasttext_model
    if _fasttext_model is not None:
        return _fasttext_model

    # Determine model path from environment or download
    model_path = os.getenv("FASTTEXT_MODEL_PATH")
    if not model_path or not os.path.exists(model_path):
        logger.info("Downloading fastText language identification model (1.18GB)...")
        try:
            model_path = hf_hub_download(
                repo_id="facebook/fasttext-language-identification",
                filename="model.bin"
            )
            logger.info(f"Model downloaded to {model_path}")
        except Exception as e:
            logger.error(f"Failed to download fastText model: {e}")
            return None

    logger.info(f"Loading fastText model from {model_path}")
    try:
        _fasttext_model = fasttext.load_model(model_path)
    except Exception as e:
        logger.error(f"Failed to load fastText model: {e}")
        return None

    return _fasttext_model

def detect_language_full(text: str) -> dict:
    """
    Detect language using fastText, returning full details.
    Returns a dict with:
        'language': two-letter language code ('am', 'om', 'ti', 'en')
        'raw_label': the raw label from fastText (e.g., '__label__amh_Ethi')
        'confidence': confidence score
    If detection fails, returns {'language': 'en', 'raw_label': None, 'confidence': 0.0}
    """
    if not text or not text.strip():
        return {'language': 'en', 'raw_label': None, 'confidence': 0.0}

    model = _load_fasttext_model()
    if model is None:
        return {'language': 'en', 'raw_label': None, 'confidence': 0.0}

    clean_text = text.replace('\n', ' ').strip()
    labels, scores = model.predict(clean_text, k=1)
    
    raw_label = labels[0]
    confidence = scores[0]
    
    # Extract label without __label__ prefix
    label = raw_label.replace('__label__', '')
    # The label format is either 'amh_Ethi' or 'am' (two-letter)
    if '_' in label:
        lang_3 = label.split('_')[0]
        language = LANG_MAP.get(lang_3, 'en')
    else:
        # Two-letter code directly (e.g., from lid.176.bin)
        language = label if label in ['am', 'om', 'ti', 'en'] else 'en'
    
    return {
        'language': language,
        'raw_label': raw_label,
        'confidence': float(confidence)
    }

def detect_language(text: str) -> str:
    """
    Detect language using fastText.
    Returns a two-letter language code ('am', 'om', 'ti', 'en').
    If detection fails, returns 'en'.
    """
    result = detect_language_full(text)
    return result['language']