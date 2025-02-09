import json
import boto3
import base64
import logging
from datetime import datetime, timedelta, timezone

# Set up logging to only output INFO level logs
logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client('s3')
BUCKET_NAME = "merhavim-patients-folder"

def lambda_handler(event, context):
    try:
        # Parse the request body. API Gateway usually sends it as a JSON string in 'body'.
        if 'body' in event:
            body = event['body']
            if isinstance(body, str):
                body = json.loads(body)
        else:
            body = event  # In case the event is already a dict.

        # Validate that an 'id' is provided.
        if 'id' not in body:
            logger.error("Missing 'id' in the request body.")
            raise ValueError("Missing 'id' in the request body.")
        id_value = str(body['id'])
        logger.info(f"Processing request for id: {id_value}")

        if 'file' in body and body['file']:
            # --- Case: Upload file ---
            logger.info("File upload detected.")
            file_base64 = body['file']
            try:
                file_bytes = base64.b64decode(file_base64)
            except Exception as decode_error:
                logger.error("Failed to decode Base64 file content.", exc_info=True)
                raise ValueError("Invalid Base64 file content.") from decode_error

            # Determine the file extension if possible.
            extension = None
            provided_file_name = body.get('fileName')
            if provided_file_name:
                # If a period is present, we assume the file name includes its extension.
                if '.' in provided_file_name:
                    extension = provided_file_name.split('.')[-1]
            if not extension and 'contentType' in body:
                content_type = body['contentType']
                content_type_mapping = {
                    "application/pdf": "pdf",
                    "video/mp4": "mp4",
                    "image/jpeg": "jpg",
                    "image/png": "png",
                    "application/json": "json"
                }
                extension = content_type_mapping.get(content_type, None)
            if not extension:
                extension = "bin"

            # Determine if the file should be overwritten.
            overwrite = body.get("overwrite", False)
            if overwrite:
                if provided_file_name:
                    # Use the exact provided filename for overwriting.
                    s3_key = f"id_{id_value}/{provided_file_name}"
                else:
                    # If no fileName is provided, fallback to timestamped name.
                    logger.info("Overwrite flag is true but no fileName provided; using timestamp instead.")
                    tz = timezone(timedelta(hours=2))
                    timestamp = datetime.now(tz).strftime("%Y-%m-%d-%H:%M:%S")
                    s3_key = f"id_{id_value}/{timestamp}.{extension}"
            else:
                tz = timezone(timedelta(hours=2))  # GMT+2, Israel time.
                timestamp = datetime.now(tz).strftime("%Y-%m-%d-%H:%M:%S")
                s3_key = f"id_{id_value}/{timestamp}.{extension}"
            logger.info(f"Constructed S3 key for file upload: {s3_key}")

            # Set the content type based on the request, defaulting to 'application/octet-stream' if not provided.
            content_type = body.get("contentType", "application/octet-stream")

            # Upload file to S3. S3 will overwrite an object if the key already exists.
            logger.info("Uploading file to S3.")
            s3_client.put_object(
                Bucket=BUCKET_NAME,
                Key=s3_key,
                Body=file_bytes,
                ContentType=content_type
            )
            logger.info(f"File uploaded successfully to {s3_key}")
            message = f"File uploaded successfully to {s3_key}"
        else:
            # --- Case: Create the directory structure ---
            logger.info("No file provided. Creating directory structure.")
            root_key = f"id_{id_value}/"
            output_key = f"{root_key}output/"
            summary_key = f"{output_key}Summary/"
            transcribe_key = f"{output_key}transcribe/"

            for key in [root_key, output_key, summary_key, transcribe_key]:
                s3_client.put_object(
                    Bucket=BUCKET_NAME,
                    Key=key,
                    Body=""
                )

            message = (
                f"Directory structure created successfully: "
                f"{root_key}, {output_key}, {summary_key}, {transcribe_key}"
            )
            logger.info("Directory structure created successfully.")
            s3_key = root_key  # Return the root directory key as a reference.

        # Return a success response with CORS headers.
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
                "Content-Type": "application/json"
            },
            "body": json.dumps({
                "message": message,
                "s3_key": s3_key
            })
        }

    except Exception as e:
        logger.error("An error occurred in lambda_handler.", exc_info=True)
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type,Authorization"
            },
            "body": json.dumps({
                "message": str(e)
            })
        }
