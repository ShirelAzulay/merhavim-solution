import json
import boto3
import logging
# IF IT IGNORES SYSTEM INSTRUCTIONS - PLAY WITH IT. I ACCIDENTALLY OVERWRITTEN IT AND I DON'T REMEMBER EXACTLY WHERE AND HOW IT WAS.

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    # Handle preflight OPTIONS request if needed
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "OPTIONS, POST",
                "Access-Control-Allow-Headers": "Content-Type, x-api-key"
            },
            "body": json.dumps("OK")
        }

    try:
        # Parse the incoming request body
        body = json.loads(event.get("body", "{}"))
        logger.info("Request body: %s", body)

        # Extract system instructions, prompt, and images
        system_instructions = body.get("system_instructions", "")
        prompt = body.get("prompt", "")   # may be empty
        images = body.get("images", [])     # list

        # Build messages array (do NOT include system instructions here)
        messages = []

        # Build user content (text + images) for the user message
        user_content = []

        # If a text prompt is provided, add it
        if prompt and prompt.strip():
            user_content.append({
                "type": "text",
                "text": prompt.strip()
            })

        # If images are provided, add them
        for img in images:
            img_data = img.get("data")
            if img_data:
                media_type = img.get("media_type", "image/jpeg")
                user_content.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": img_data
                    }
                })
            else:
                logger.warning("An image was provided without data. Skipping.")

        # Ensure we have something to send as a user message
        if not user_content:
            logger.error("No valid user content provided in request body.")
            return {
                "statusCode": 400,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "No valid user content provided in request body."})
            }

        # Add the user message with text/images
        messages.append({
            "role": "user",
            "content": user_content
        })

        # Read max_tokens from the request body, defaulting to 100 if invalid
        max_tokens = body.get("max_tokens", 100)
        try:
            max_tokens = int(max_tokens)
        except (ValueError, TypeError):
            logger.warning("Invalid max_tokens value provided; defaulting to 100.")
            max_tokens = 100

        # Build the payload for the Bedrock model.
        # Note that system instructions are sent as a separate field rather than part of the messages.
        payload = {
            "anthropic_version": "bedrock-2023-05-31",  # Update version if needed
            "system": system_instructions,
            "max_tokens": max_tokens,
            "messages": messages,
            "temperature": 0.7,
            "top_p": 0.95,
            "stop_sequences": []
        }

        # If system instructions exist, include them as a separate parameter.
        if system_instructions and system_instructions.strip():
            payload["system"] = system_instructions.strip()

        # Create the Bedrock runtime client and invoke the model
        client = boto3.client('bedrock-runtime')
        logger.info("Invoking Bedrock model with payload: %s", payload)
        
        response = client.invoke_model(
            modelId='eu.anthropic.claude-3-5-sonnet-20240620-v1:0',
            body=json.dumps(payload).encode("utf-8"),
            contentType="application/json"
        )
        
        result = response["body"].read().decode("utf-8")
        logger.info("Bedrock result: %s", result)
        
        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"result": result})
        }
    
    except Exception as e:
        logger.exception("Error invoking Bedrock model:")
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)})
        }
