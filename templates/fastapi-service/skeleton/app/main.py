"""HTTP entrypoint for the generated FastAPI service."""

from fastapi import FastAPI

SERVICE_NAME = "${{ values.name }}"

app = FastAPI(title=SERVICE_NAME)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": SERVICE_NAME}
