import os
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv

from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma

# ---------------- ENV ----------------
# Load from server/.env so OPENAI_API_KEY is available
print("Starting csv_ingestion...", flush=True)
load_dotenv(Path(__file__).resolve().parents[1] / "server" / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# ---------------- PATHS ----------------
DATASET_DIR = Path(__file__).resolve().parent / "datasets"

CSV_FILES = [
    DATASET_DIR / "conversations_training.csv",
    DATASET_DIR / "Dataset.csv"
]

# Same location as server so ingested data is used by the app
PERSIST_DIRECTORY = Path(__file__).resolve().parents[1] / "server" / "db" / "chroma_db"


# ---------------- LOAD CSVs ----------------
def load_csvs():
    print("Loading CSV datasets...", flush=True)

    dataframes = []

    for file in CSV_FILES:

        if not file.exists():
            print(f"Warning: {file.name} not found, skipping", flush=True)
            continue

        df = pd.read_csv(file)

        print(f"\nLoaded {file.name}", flush=True)
        print("Rows:", len(df), flush=True)
        print("Columns:", list(df.columns), flush=True)

        dataframes.append((file.name, df))

    return dataframes


# ---------------- CONVERT TO DOCUMENTS ----------------
def create_documents(dataframes):

    print("\nConverting rows to documents...", flush=True)

    documents = []

    for dataset_name, df in dataframes:

        for _, row in df.iterrows():

            # adjust columns if needed
            if "Context" in df.columns and "Response" in df.columns:
                text = f"""
User: {row['Context']}
Response: {row['Response']}
"""
            elif "Response" in df.columns:
                text = str(row["Response"])
            else:
                # fallback: join all columns
                text = " ".join(str(v) for v in row.values)

            content_type = "dialogue" if "Context" in df.columns and "Response" in df.columns else "psychoeducation"
documents.append(
    Document(
        page_content=text,
        metadata={
            "dataset": dataset_name,
            "content_type": content_type
        }
    )
)

    print("Documents created:", len(documents), flush=True)
    return documents


# ---------------- STORE IN VECTOR DB ----------------
def store_documents(documents):

    print("\nCreating embeddings...", flush=True)

    embedding_model = OpenAIEmbeddings(
        model="text-embedding-3-small"
    )

    vectorstore = Chroma.from_documents(
        documents=documents,
        embedding=embedding_model,
        persist_directory=str(PERSIST_DIRECTORY),
        collection_metadata={"hnsw:space": "cosine"}
    )

    print("Stored documents in vector DB", flush=True)
    return vectorstore


# ---------------- MAIN ----------------
def main():

    print("=== CSV Ingestion Pipeline ===")

    dataframes = load_csvs()

    documents = create_documents(dataframes)

    store_documents(documents)

    print("\nCSV ingestion complete", flush=True)


if __name__ == "__main__":
    main()