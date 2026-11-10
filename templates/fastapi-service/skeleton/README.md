# ${{ values.name }}

${{ values.description }}

Owner: ${{ values.owner }}

## Run

```sh
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

## Test

```sh
pytest
```

## Container

```sh
docker build -t ${{ values.name }} .
docker run --rm -p 8000:8000 ${{ values.name }}
```
