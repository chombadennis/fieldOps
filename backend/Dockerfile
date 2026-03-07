# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY ./requirements.txt /app/requirements.txt

# Install any needed packages specified in requirements.txt
# --no-cache-dir ensures we don't store the download cache, keeping the image small
# --upgrade ensures we get the latest versions of the dependencies
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Copy the rest of the application's code from your host to your image filesystem.
# The .dockerignore file will prevent unnecessary files from being copied.
COPY ./app /app/app

# Inform Docker that the container is listening on port 8000.
EXPOSE 8000

# Run uvicorn server when the container launches.
# The --host 0.0.0.0 is crucial to expose the server outside the container.
# The --port 8000 matches the EXPOSE instruction.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
