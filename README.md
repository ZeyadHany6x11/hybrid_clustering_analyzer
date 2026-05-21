# Hybrid Clustering Analyzer

A full-stack clustering analysis tool for uploading tabular datasets, preprocessing numeric features, running multiple unsupervised learning algorithms, and comparing their quality with standard clustering metrics.

The project combines a Flask/scikit-learn API with a Vite + React + TypeScript interface.

## Features

- Upload CSV, TSV, JSON, or TXT datasets up to 50 MB.
- Load built-in sample datasets: Iris, blobs, moons, circles, and anisotropic blobs.
- Select numeric feature columns for clustering.
- Handle missing values by mean, median, zero fill, or row dropping.
- Scale features with StandardScaler, MinMaxScaler, or no scaling.
- Run K-Means, DBSCAN, and Gaussian Mixture Models.
- Auto-detect K-Means cluster count with an elbow-method heuristic.
- Reuse the K-Means optimal K for GMM components when requested.
- Compare models using Silhouette, Davies-Bouldin, and Calinski-Harabasz scores.
- Visualize elbow curves, cluster scatter plots, cluster sizes, and model rankings.

## Project Structure

```text
artifacts/
  flask-api/
    app.py              # Flask API routes and in-memory sessions
    preprocessing.py    # Dataset loading, summaries, scaling, missing values
    clustering.py       # K-Means, DBSCAN, and GMM wrappers
    evaluation.py       # Clustering metrics and model ranking
    requirements.txt    # Python dependencies
  clustering-ui/
    src/
      App.tsx
      components/       # Dataset, configuration, and results UI
      lib/api.ts        # API response helper
    package.json        # Frontend scripts and dependencies
    vite.config.ts      # Vite config and /api proxy
```

## Requirements

- Python 3.10+
- Node.js 18+
- npm

## Setup

### 1. Start the Flask API

From the project root:

```powershell
cd artifacts\flask-api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

The API runs on:

```text
http://127.0.0.1:5000
```

### 2. Start the React UI

Open a second terminal from the project root:

```powershell
cd artifacts\clustering-ui
npm install
npm run dev
```

The UI runs on:

```text
http://localhost:5173
```

Vite proxies frontend requests from `/api` to `http://127.0.0.1:5000`.

## Usage

1. Open the UI at `http://localhost:5173`.
2. Upload a supported dataset or load one of the sample datasets.
3. Review the dataset summary and detected numeric columns.
4. Choose algorithms, preprocessing options, and model parameters.
5. Run the clustering analysis.
6. Compare models in the ranking table and inspect visualizations for each algorithm.

## API Endpoints

### `GET /api/healthz`

Checks whether the API is running.

### `GET /api/samples`

Lists available sample datasets.

### `POST /api/upload`

Loads a dataset and creates an in-memory session.

Accepted inputs:

- Multipart file upload with `file`
- JSON body with a sample dataset request:

```json
{
  "use_sample": true,
  "sample_name": "iris"
}
```

### `POST /api/analyze`

Runs clustering for a previously uploaded dataset.

Example body:

```json
{
  "session_id": "your-session-id",
  "algorithms": ["kmeans", "dbscan", "gmm"],
  "scaling_method": "standard",
  "handle_missing": "mean",
  "feature_columns": [],
  "kmeans_params": {
    "n_clusters": null,
    "max_k": 10,
    "random_state": 42
  },
  "dbscan_params": {
    "eps": 0.5,
    "min_samples": 5
  },
  "gmm_params": {
    "n_components": null,
    "covariance_type": "full",
    "random_state": 42
  }
}
```

### `GET /api/results?session_id=<id>&include_points=true`

Returns stored results, model metadata, labels, metrics, and optional point-level data.

Optional query parameters:

- `algorithm=kmeans|dbscan|gmm`
- `include_points=true|false`

## Algorithms

### K-Means

Uses `sklearn.cluster.KMeans` with `k-means++` initialization and `n_init=10`. If `n_clusters` is not provided, the API tests values from `1` to `max_k` and estimates the elbow point from WCSS/inertia.

### DBSCAN

Uses `sklearn.cluster.DBSCAN` with configurable `eps` and `min_samples`. Noise points are labeled as `-1`.

### Gaussian Mixture Model

Uses `sklearn.mixture.GaussianMixture` with configurable component count and covariance type. The response includes cluster probabilities, average assignment confidence, AIC, and BIC.

## Evaluation Metrics

- Silhouette score: higher is better.
- Davies-Bouldin score: lower is better.
- Calinski-Harabasz score: higher is better.
- Composite score: average of available Silhouette and scaled negative Davies-Bouldin values.

Metrics ignore DBSCAN noise points where appropriate.

## Build and Checks

Frontend type check:

```powershell
cd artifacts\clustering-ui
npm run typecheck
```

Frontend production build:

```powershell
cd artifacts\clustering-ui
npm run build
```

Preview the production build:

```powershell
cd artifacts\clustering-ui
npm run serve
```

## Notes

- API sessions are stored in memory, so uploaded datasets and results disappear when the Flask process restarts.
- Only numeric columns are used for clustering. Categorical columns are shown in the dataset summary but are not encoded.
- The frontend assumes the API is reachable through `/api`; run the Vite dev server or configure an equivalent proxy in production.
- For datasets with one numeric feature, scatter plots reuse the same feature on the y-axis.

## Troubleshooting

- If the UI shows API errors, confirm the Flask API is running on `http://127.0.0.1:5000`.
- If uploads fail, check that the file is CSV, TSV, JSON, or TXT and under 50 MB.
- If no clustering can run, make sure the dataset contains at least one numeric column.
- If DBSCAN marks every point as noise, increase `eps` or decrease `min_samples`.
