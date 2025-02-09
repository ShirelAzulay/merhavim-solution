import json
import boto3
import logging
import time

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.DEBUG)  # Set to DEBUG for verbose logging

def lambda_handler(event, context):
    logger.debug("Lambda function started.")
    logger.debug(f"Received event: {json.dumps(event)}")
    
    try:
        # 1. Parse request parameters (pathParameters or queryStringParameters)
        patient_id = None
        file_name = None
        
        logger.debug("Parsing request parameters...")
        if event.get('pathParameters'):
            logger.debug("Found pathParameters")
            patient_id = event['pathParameters'].get('patientId')
            file_name = event['pathParameters'].get('fileName')
        
        if event.get('queryStringParameters'):
            logger.debug("Found queryStringParameters")
            qs_params = event['queryStringParameters']
            if not patient_id:
                patient_id = qs_params.get('patientId')
            if not file_name:
                file_name = qs_params.get('fileName') or qs_params.get('filename')
        
        logger.debug(f"Parsed patient_id: {patient_id}, file_name: {file_name}")
        
        if not (patient_id and file_name):
            error_msg = "Missing patientId or fileName"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        # 2. Construct the S3 key prefix for this patient
        s3_prefix = f"id_{patient_id}/"
        logger.debug(f"Constructed S3 prefix: {s3_prefix}")
        
        # 3. Create the S3 client
        s3 = boto3.client('s3')
        bucket_name = 'merhavim-patients-folder'
        logger.debug("S3 client created.")
        
        # 4. Check if file_name contains a wildcard
        if "*" in file_name:
            logger.debug("Wildcard detected in file_name.")
            # Extract the suffix to match, e.g., '*.pdf' -> '.pdf'
            suffix = file_name.replace("*", "")
            logger.debug(f"Extracted suffix for filtering: {suffix}")
            
            # List objects under the patient's folder.
            logger.debug("Listing objects from S3...")
            start_time = time.time()
            response = s3.list_objects_v2(Bucket=bucket_name, Prefix=s3_prefix)
            elapsed_time = time.time() - start_time
            logger.debug(f"S3 list_objects_v2 call took {elapsed_time:.2f} seconds")
            logger.debug(f"S3 response: {json.dumps(response, default=str)}")
            
            matching_keys = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    key = obj['Key']
                    if key.endswith(suffix):
                        matching_keys.append(key)
                        logger.debug(f"Matched key: {key}")
            else:
                logger.debug("No contents found in the S3 response.")
            
            if not matching_keys:
                error_msg = "No matching files found"
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            # For each matching key, generate a presigned URL and extract the file name.
            files = []
            for key in matching_keys:
                presigned_url = s3.generate_presigned_url(
                    ClientMethod='get_object',
                    Params={'Bucket': bucket_name, 'Key': key},
                    ExpiresIn=900  # 15 minutes
                )
                # Assuming key format "id_{patient_id}/fileName", extract fileName
                file_only = key.split('/')[-1]
                files.append({
                    "url": presigned_url,
                    "fileName": file_only
                })
                logger.debug(f"Generated presigned URL for key {key}: {presigned_url}")
            
            logger.info("Returning list of presigned URLs for wildcard match.")
            return {
                "statusCode": 200,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,Authorization",
                    "Content-Type": "application/json"
                },
                "body": json.dumps({"files": files})
            }
        
        else:
            # When no wildcard is present, treat it as a specific file lookup.
            s3_key = f"id_{patient_id}/{file_name}"
            logger.debug(f"Constructed S3 key for specific file lookup: {s3_key}")
            
            presigned_url = s3.generate_presigned_url(
                ClientMethod='get_object',
                Params={
                    'Bucket': bucket_name,
                    'Key': s3_key
                },
                ExpiresIn=900  # 15 minutes
            )
            logger.debug(f"Generated presigned URL: {presigned_url}")
            
            logger.info("Returning presigned URL for specific file.")
            # Return in the same format with a single file in the array.
            return {
                "statusCode": 200,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,Authorization",
                    "Content-Type": "application/json"
                },
                "body": json.dumps({
                    "files": [{
                        "url": presigned_url,
                        "fileName": file_name
                    }]
                })
            }
    
    except Exception as e:
        logger.exception(f"An error occurred: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*",  # Include these even on error
                "Access-Control-Allow-Methods": "GET,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type,Authorization"
            },
            "body": json.dumps({"message": str(e)})
        }
