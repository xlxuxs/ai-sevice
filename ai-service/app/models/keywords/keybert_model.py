from keybert import KeyBERT
from typing import List
from .base import BaseKeywordModel

# Stopword lists for supported languages
STOPWORDS = {
    "am": [
        "እና", "እሱ", "እሷ", "እነሱ", "ነው", "ላይ", "ውስጥ", "ጋር", "ለ", "ሲሆን",
        "እንደ", "ይህ", "ይህን", "ይህች", "እነዚህ", "እነዚያ", "ማን", "ምን", "የት",
        "መቼ", "እንዴት", "በጣም", "አንዳንድ", "ሁሉም", "ማንኛውም", "አይደለም"
    ],
    "om": [
        "kan", "kana", "sun", "isa", "isheen", "isaan", "n", "tti", "irratti",
        "keessa", "wajjin", "f", "akka", "maal", "eessa", "yoom", "akkam",
        "baay'ee", "tokko", "hunduma", "tokkoyyuu", "miti"
    ],
    "ti": [
        "እዚ", "እቲ", "እንታይ", "እንከ", "እሱ", "ንሳ", "ንሶም", "ኣብ", "ውሽጢ",
        "ምስ", "ን", "ከም", "እዚኣ", "እዚኦም", "መን", "ኣበይ", "መዓስ", "ከመይ",
        "ኣዝዩ", "ገለ", "ኩሉ", "ዝኾነ", "ኣይኮነን"
    ],
    "en": [
        "a", "about", "above", "across", "after", "afterwards", "again", "against",
        "all", "almost", "alone", "along", "already", "also", "although", "always",
        "am", "among", "amongst", "amoungst", "amount", "an", "and", "another",
        "any", "anyhow", "anyone", "anything", "anyway", "anywhere", "are",
        "around", "as", "at", "back", "be", "became", "because", "become",
        "becomes", "becoming", "been", "before", "beforehand", "behind", "being",
        "below", "beside", "besides", "between", "beyond", "bill", "both",
        "bottom", "but", "by", "call", "can", "cannot", "cant", "co", "computer",
        "con", "could", "couldnt", "cry", "de", "describe", "detail", "do", "done",
        "down", "due", "during", "each", "eg", "eight", "either", "eleven", "else",
        "elsewhere", "empty", "enough", "etc", "even", "ever", "every", "everyone",
        "everything", "everywhere", "except", "few", "fifteen", "fify", "fill",
        "find", "fire", "first", "five", "for", "former", "formerly", "forty",
        "found", "four", "from", "front", "full", "further", "get", "give", "go",
        "had", "has", "hasnt", "have", "he", "hence", "her", "here", "hereafter",
        "hereby", "herein", "hereupon", "hers", "herself", "him", "himself", "his",
        "how", "however", "hundred", "i", "ie", "if", "in", "inc", "indeed",
        "interest", "into", "is", "it", "its", "itself", "keep", "last", "latter",
        "latterly", "least", "less", "ltd", "made", "many", "may", "me", "meanwhile",
        "might", "mill", "mine", "more", "moreover", "most", "mostly", "move",
        "much", "must", "my", "myself", "name", "namely", "neither", "never",
        "nevertheless", "next", "nine", "no", "nobody", "none", "noone", "nor",
        "not", "nothing", "now", "nowhere", "of", "off", "often", "on", "once",
        "one", "only", "onto", "or", "other", "others", "otherwise", "our", "ours",
        "ourselves", "out", "over", "own", "part", "per", "perhaps", "please",
        "put", "rather", "re", "same", "see", "seem", "seemed", "seeming", "seems",
        "serious", "several", "she", "should", "show", "side", "since", "sincere",
        "six", "sixty", "so", "some", "somehow", "someone", "something", "sometime",
        "sometimes", "somewhere", "still", "such", "system", "take", "ten", "than",
        "that", "the", "their", "them", "themselves", "then", "thence", "there",
        "thereafter", "thereby", "therefore", "therein", "thereupon", "these",
        "they", "thick", "thin", "third", "this", "those", "though", "three",
        "through", "throughout", "thru", "thus", "to", "together", "too", "top",
        "toward", "towards", "twelve", "twenty", "two", "un", "under", "until",
        "up", "upon", "us", "very", "via", "was", "we", "well", "were", "what",
        "whatever", "when", "whence", "whenever", "where", "whereafter", "whereas",
        "whereby", "wherein", "whereupon", "wherever", "whether", "which", "while",
        "whither", "who", "whoever", "whole", "whom", "whose", "why", "will",
        "with", "within", "without", "would", "yet", "you", "your", "yours",
        "yourself", "yourselves"
    ]
}

class KeyBERTKeywordModel(BaseKeywordModel):
    def __init__(self, model_name: str = "paraphrase-multilingual-MiniLM-L12-v2"):
        self._name = model_name
        self.model = KeyBERT(model=model_name)
    
    @property
    def name(self) -> str:
        return self._name
    
    def extract(self, text: str, language: str = 'en', top_n: int = 5) -> List[str]:
        stopwords = STOPWORDS.get(language, STOPWORDS['en'])
        keywords = self.model.extract_keywords(
            text,
            keyphrase_ngram_range=(1, 2),
            stop_words=stopwords,
            top_n=top_n
        )
        # Post-processing
        cleaned = []
        seen = set()
        for kw, _ in keywords:
            kw_clean = kw.lower().strip()
            kw_clean = ''.join(c for c in kw_clean if c.isalnum() or c.isspace())
            kw_clean = ' '.join(kw_clean.split())
            if kw_clean and kw_clean not in seen and len(kw_clean) > 2:
                seen.add(kw_clean)
                cleaned.append(kw_clean)
        return cleaned