FROM python:3.12-slim

WORKDIR /app

# fonts-dejavu-core — eslatma rasmiga (reminder_image.py) matn chizish uchun kerak
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "add_account_bot.py"]
