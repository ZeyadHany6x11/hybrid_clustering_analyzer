import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from io import StringIO


def load_dataset(file_content: str, file_type: str = "csv") -> pd.DataFrame:
    if file_type == "csv":
        df = pd.read_csv(StringIO(file_content))
    elif file_type == "json":
        df = pd.read_json(StringIO(file_content))
    elif file_type == "tsv":
        df = pd.read_csv(StringIO(file_content), sep="\t")
    else:
        raise ValueError(f"Unsupported file type: {file_type}")
    return df


def preprocess(
    df: pd.DataFrame,
    scaling_method: str = "standard",
    handle_missing: str = "drop",
    feature_columns: list = None,
) -> tuple:
    if feature_columns:
        numeric_cols = [c for c in feature_columns if c in df.columns]
    else:
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    if not numeric_cols:
        raise ValueError("No numeric columns found for clustering.")

    data = df[numeric_cols].copy()

    missing_counts = data.isnull().sum().to_dict()

    if handle_missing == "drop":
        data = data.dropna()
    elif handle_missing == "mean":
        data = data.fillna(data.mean())
    elif handle_missing == "median":
        data = data.fillna(data.median())
    elif handle_missing == "zero":
        data = data.fillna(0)
    else:
        data = data.dropna()

    if scaling_method == "standard":
        scaler = StandardScaler()
    elif scaling_method == "minmax":
        scaler = MinMaxScaler()
    elif scaling_method == "none":
        scaler = None
    else:
        scaler = StandardScaler()

    if scaler is not None:
        scaled_array = scaler.fit_transform(data)
    else:
        scaled_array = data.values

    info = {
        "n_samples": int(scaled_array.shape[0]),
        "n_features": int(scaled_array.shape[1]),
        "feature_names": list(numeric_cols),
        "missing_counts": {k: int(v) for k, v in missing_counts.items()},
        "scaling_method": scaling_method,
        "handle_missing": handle_missing,
    }

    return scaled_array, data, info


def get_dataset_summary(df: pd.DataFrame) -> dict:
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()

    summary = {
        "n_rows": int(len(df)),
        "n_cols": int(len(df.columns)),
        "columns": list(df.columns),
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "missing_values": {col: int(df[col].isnull().sum()) for col in df.columns},
        "dtypes": {col: str(df[col].dtype) for col in df.columns},
    }

    if numeric_cols:
        desc = df[numeric_cols].describe()
        summary["statistics"] = {
            col: {
                "mean": float(desc[col]["mean"]) if not np.isnan(desc[col]["mean"]) else None,
                "std": float(desc[col]["std"]) if not np.isnan(desc[col]["std"]) else None,
                "min": float(desc[col]["min"]) if not np.isnan(desc[col]["min"]) else None,
                "max": float(desc[col]["max"]) if not np.isnan(desc[col]["max"]) else None,
            }
            for col in numeric_cols
        }

    return summary
