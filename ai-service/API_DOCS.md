# AI Service API Documentation

## 1. Overview

The AI service provides sentiment analysis, keyword extraction, language detection, and policy topic suggestion for Ethiopian languages (Amharic, Oromo, Tigrinya) and English. It acts as a lightweight proxy that forwards requests to dedicated Hugging Face Spaces for remote processing (default mode), with an optional local fallback for development or offline use.

**Features**:

- Sentiment labels: `positive`, `negative`, `neutral` (with confidence score)
- Keyword extraction (top 5)
- Language detection (fastText with mapping for Oromo dialects)
- Policy topic suggestion (zero‑shot classification)
- Dual mode: `remote` (uses Spaces) or `local` (uses local models)

## 2. Base URL

| Environment | URL                     |
| ----------- | ----------------------- |
| Local       | `http://localhost:8000` |
| Production  | Internal network only   |

## 3. Authentication

All endpoints except `/health` require an internal API key.

    X-Internal-API-Key: your-internal-api-key

The key must match the `INTERNAL_API_KEY` environment variable set in both the AI service and the backend. Requests without a valid key receive a `403 Forbidden` response with a JSON error body.

## 4. Uniform Response Format

Success responses are JSON objects (no `status` wrapper). Error responses return HTTP 500 with a `"detail"` field.

**Success example (`/analyze`)**:

```json
    {
      "sentiment": "positive",
      "confidence": 0.73,
      "keywords": ["policy", "good"],
      "language": "am",
      "sentiment_model": "twitter-xlm-roberta",
      "keyword_model": "remote_keybert"
    }
```

**Error example**:

```json
    { "detail": "Model loading failed" }
```

## 5. Endpoints

### 5.1 POST /analyze

Primary endpoint for sentiment and keyword extraction.

**Request body**:

| Field      | Type   | Required | Description                                                 |
| ---------- | ------ | -------- | ----------------------------------------------------------- |
| `text`     | string | yes      | Comment text (max 2000 characters)                          |
| `language` | string | no       | ISO code (`am`, `om`, `ti`, `en`); auto‑detected if omitted |

**Response (200 OK)**:

| Field             | Type             | Description                                          |
| ----------------- | ---------------- | ---------------------------------------------------- |
| `sentiment`       | string           | `positive`, `negative`, or `neutral`                 |
| `confidence`      | float            | 0.0–1.0                                              |
| `keywords`        | array of strings | Top 5 keywords                                       |
| `language`        | string           | Detected or provided language code                   |
| `sentiment_model` | string           | Model used (e.g., `twitter-xlm-roberta`)             |
| `keyword_model`   | string           | `remote_keybert` (remote) or `local_keybert` (local) |

**Error responses**:

| Status | Code                  | Description                |
| ------ | --------------------- | -------------------------- |
| 403    | Forbidden             | Invalid or missing API key |
| 500    | Internal Server Error | JSON with `"detail"` field |

### 5.2 POST /suggest-topics

Suggests policy topics from a predefined list using zero‑shot classification. Supports Amharic, Oromo, Tigrinya, and English.

**Request body**:

| Field              | Type   | Required | Description                                     |
| ------------------ | ------ | -------- | ----------------------------------------------- |
| `text`             | string | yes      | Policy title + description (min 10 characters)  |
| `candidate_topics` | array  | no       | Custom topic list (default uses 30+ categories) |

**Response (200 OK)**:

```json
    {
      "topics": [
        { "topic": "Roads", "confidence": 0.76 },
        { "topic": "Transport", "confidence": 0.06 },
        { "topic": "Public Safety", "confidence": 0.02 }
      ]
    }
```

**Default topics** (if `candidate_topics` not provided):

- Health
- Education
- Water Supply
- Electricity
- Housing
- Transport
- Roads
- Bridges
- Railways
- Airports
- Digital Infrastructure
- Agriculture
- Irrigation
- Livestock
- Forestry
- Environment
- Climate Change
- Economy
- Employment
- Small Business
- Industry
- Trade
- Tourism
- Social Protection
- Pension
- Disability Support
- Food Security
- Poverty Reduction
- Governance
- Justice
- Police
- Defense
- Public Safety
- Urban Planning
- Rural Development
- Land Administration
- Migration
- Sports
- Culture
- Youth
- Women Affairs
- Diaspora

**Error responses**: 500 with `{"detail": "..."}`.

### 5.3 GET /health

Health check. Returns `{"status": "ok"}`.

### 5.4 POST /benchmark (Deprecated)

Removed in remote mode. Returns `501 Not Implemented`. (Available only in local mode for model comparison.)

## 6. Environment Variables

| Variable              | Description                                 | Default                                                    |
| --------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| `AI_MODE`             | `remote` (use Spaces) or `local` (fallback) | `remote`                                                   |
| `LANGID_SPACE_URL`    | URL of fasttext‑langid Space                | `https://abyayel-fasttext-langid.hf.space/detect`          |
| `SENTIMENT_SPACE_URL` | URL of sentiment‑models Space               | `https://abyayel-sentiment-models.hf.space/sentiment`      |
| `TOPIC_SPACE_URL`     | URL of topic‑model Space                    | `https://abyayel-topic-model.hf.space/suggest-topics`      |
| `KEYWORD_SPACE_URL`   | URL of keyword‑extractor Space              | `https://abyayel-keyword-extractor.hf.space/extract`       |
| `INTERNAL_API_KEY`    | Internal API key for authentication         | (must be set in production)                                |
| `FASTTEXT_MODEL_PATH` | Local fastText model path (local mode)      | `lid.176.ftz` (compressed) or auto‑downloaded 1.2 GB model |

## 7. Language Detection

- **Remote**: Uses `fasttext-langid` Space (Facebook 1.2 GB model, hosted in cloud).
- **Local**: Uses the same Facebook model (auto‑downloaded) or compressed `lid.176.ftz`.

**Mapping of fastText labels to our language codes**:

| Language | Our Code | fastText label(s) mapped to our code           |
| -------- | -------- | ---------------------------------------------- |
| Amharic  | `am`     | `amh_Ethi`                                     |
| Tigrinya | `ti`     | `tir_Ethi`                                     |
| Oromo    | `om`     | `orm_Latn`, `gaz_Latn`, `gax_Latn`, `hae_Latn` |
| English  | `en`     | `eng_Latn`                                     |

If detection fails (confidence too low or no label), the service defaults to `en`.

## 8. Sentiment Models

**Remote mode (default)**:

The sentiment Space loads two models:

- **Amharic / English**: `cardiffnlp/twitter-xlm-roberta-base-sentiment` (supports neutral)
- **Tigrinya**: `fgaim/tiroberta-sentiment` (binary positive/negative only; neutral is approximated by fallback)

**Local mode**: The original model registry is used, which includes additional models:

| Language              | Model ID                                           |
| --------------------- | -------------------------------------------------- |
| Amharic               | `rasyosef/bert-medium-amharic-finetuned-sentiment` |
| Amharic (additional)  | `Hailay/FT_EXLMR`                                  |
| Oromo                 | `Hailay/FT_EXLMR`                                  |
| Tigrinya              | `fgaim/tiroberta-sentiment`                        |
| Tigrinya (additional) | `Hailay/FT_EXLMR`                                  |
| English               | `cardiffnlp/twitter-xlm-roberta-base-sentiment`    |

All models are lazy‑loaded and cached in memory.

## 9. Keyword Extraction

- **Remote mode**: Uses a Space with `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` + KeyBERT. Returns top 5 keywords.
- **Local mode**: Uses the same KeyBERT setup with the multilingual sentence transformer. Stopwords are used for Amharic, Oromo, Tigrinya, and English.

## 10. Limitations

- **Remote mode**: Requires internet access. Spaces have cold start delays (first request after inactivity may take several seconds). Free tier may throttle heavy usage.
- **Oromo sentiment**: Not supported in remote mode; Oromo comments always return `neutral` with low confidence (0.3), triggering manual review. In local mode, the `Hailay/FT_EXLMR` model can be used, but accuracy is low (around 30%).
- **Romanised script**: Text written in Latin script (e.g., “Selam”) may be detected as English; use Ethiopic script for best results.
- **Neutral detection**: The Tigrinya model in remote mode is binary; neutral is approximated. In local mode, the same applies.

## 11. Example cURL Commands

**Analyze (Amharic, auto‑detect language)**:

```bash
    curl -X POST http://localhost:8000/analyze \
      -H "Content-Type: application/json" \
      -d '{"text": "ይህ ፖሊሲ ጥሩ ነው"}'
```

**Analyze (English, explicit language)**:

```bash
    curl -X POST http://localhost:8000/analyze \
      -H "Content-Type: application/json" \
      -d '{"text": "This policy is excellent", "language": "en"}'
```

**Suggest topics**:

```bash
    curl -X POST http://localhost:8000/suggest-topics \
      -H "Content-Type: application/json" \
      -d '{"text": "Improve road safety in rural areas"}'
```

**Health check**:

```bash
    curl http://localhost:8000/health
```
