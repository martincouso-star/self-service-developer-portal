# ${{ values.name }}

${{ values.description }}

Owner: ${{ values.owner }}

## Run

```sh
npm install
npm run build
npm start
```

## Test

```sh
npm test
```

## Container

```sh
docker build -t ${{ values.name }} .
docker run --rm -p 8080:8080 ${{ values.name }}
```
