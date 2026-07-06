up:
\tdocker compose up -d --build

down:
\tdocker compose down

logs:
\tdocker compose logs -f --tail=200

seed-profiles:
\tpython3 -m venv .venv && . .venv/bin/activate && pip install -r data/generators/requirements.txt && python data/generators/profiles_gen.py 50
