# Utilise une image Python officielle, version allégée
FROM python:3.11-slim

# Empêche Python de créer des fichiers .pyc et force l'affichage des logs en direct
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Définit le dossier de travail dans le conteneur
WORKDIR /app

# Installe les dépendances système nécessaires pour PostgreSQL
RUN apt-get update \
    && apt-get install -y libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Copie le fichier des dépendances et les installe
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copie tout le reste du code source du service
COPY . /app/