# Requirements

The project has no dependency to install: no Python package, no Node.js, no build step.

## To browse the site

A recent browser (Chrome, Edge, Firefox or Safari) with JavaScript enabled.

Cookies must be allowed for the saved searches, the search history, the tracker and the settings to be kept. The search itself works without them.

## To run the site locally

Python 3.10 or newer, only to serve the static files:

```bash
python3 -m http.server 8000 --directory docs --bind 127.0.0.1
```

Then open http://127.0.0.1:8000/. Any other static file server works too.

## To refresh the data

Python 3.10 or newer, standard library only, and an Internet access to the official drop table page:

```bash
python3 data-retriever.py
```

## To run the tests

Python 3.10 or newer, standard library only:

```bash
python3 -m unittest discover -s tests -v
```
