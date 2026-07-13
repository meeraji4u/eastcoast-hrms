FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg2 ca-certificates unixodbc unixodbc-dev gcc g++ apt-transport-https \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/msodbcsql17.deb \
        https://packages.microsoft.com/debian/12/prod/pool/main/m/msodbcsql17/msodbcsql17_17.10.6.1-1_amd64.deb \
    && ACCEPT_EULA=Y apt-get update \
    && ACCEPT_EULA=Y apt-get install -y /tmp/msodbcsql17.deb \
    && rm -f /tmp/msodbcsql17.deb \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Permanent OpenSSL fix for older SQL Server TLS compatibility
COPY openssl_permissive.cnf /app/openssl_permissive.cnf
ENV OPENSSL_CONF=/app/openssl_permissive.cnf

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
