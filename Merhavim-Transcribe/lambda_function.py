import json
import boto3
import time
import logging
import uuid
import os

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Constants for S3 bucket
S3_BUCKET = 'merhavim-patients-folder'

def lambda_handler(event, context):
    """
    AWS Lambda function that:
      1. Verifies that the provided file exists in the patient's folder.
      2. Starts an Amazon Transcribe job on the file.
      3. Polls for the transcription job to complete.
      4. Copies the transcript output to the patient's folder,
         then deletes it from the bucket root.
      5. Returns the transcript text.
      
    Implements CORS and error handling.
    """
    # --- CORS Preflight handling ---
    if event.get('httpMethod', '') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': ''
        }
    
    # --- Only allow POST ---
    if event.get('httpMethod') != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': 'Method Not Allowed'
        }
    
    try:
        # --- Parse request body ---
        body = json.loads(event.get('body', '{}'))
        patient_id = body.get('patientID')
        file_name = body.get('fileName')  # e.g., "220206-143000.mp4"
        
        if not patient_id or not file_name:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({"error": "Missing patientID and/or fileName"})
            }
        
        # Define the S3 key for the video file.
        s3_key_video = f"id_{patient_id}/{file_name}"
        s3_client = boto3.client('s3')
        logger.info("Checking for file in S3: Bucket=%s, Key=%s", S3_BUCKET, s3_key_video)

        # --- Verify that the file exists in S3 ---
        try:
            head_response = s3_client.head_object(Bucket=S3_BUCKET, Key=s3_key_video)
            content_type = head_response.get('ContentType', '')
            if content_type.lower() != 'video/mp4':
                return {
                    'statusCode': 400,
                    'headers': {'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({"error": "The file in S3 is not a valid MP4 video."})
                }
        except s3_client.exceptions.NoSuchKey:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({"error": "File not found in S3."})
            }
        except Exception as e:
            logger.exception("Error reading S3 object metadata")
            return {
                'statusCode': 500,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({"error": f"Error checking file: {str(e)}"})
            }
        
        # --- Start Amazon Transcribe Job ---
        transcribe_client = boto3.client('transcribe')
        # Use a unique job name to avoid conflicts.
        unique_job_name = f"transcription_{patient_id}_{uuid.uuid4().hex}"
        media_uri = f"s3://{S3_BUCKET}/{s3_key_video}"
        
        try:
            transcribe_client.start_transcription_job(
                TranscriptionJobName=unique_job_name,
                LanguageCode='he-IL',
                Media={'MediaFileUri': media_uri},
                OutputBucketName=S3_BUCKET  # Transcribe writes output as <unique_job_name>.json in the bucket root.
            )
        except transcribe_client.exceptions.ConflictException:
            logger.info("Transcribe job already exists. Proceeding to poll status.")
        except Exception as e:
            logger.exception("Failed to start transcription job")
            return {
                'statusCode': 500,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({"error": f"Failed to start transcription job: {str(e)}"})
            }
        
        # --- Poll for Transcription Job Completion ---
        timeout_seconds = 840  # 10 minutes timeout
        poll_interval = 10
        elapsed = 0
        
        while elapsed < timeout_seconds:
            job = transcribe_client.get_transcription_job(TranscriptionJobName=unique_job_name)
            status = job['TranscriptionJob']['TranscriptionJobStatus']
            if status == 'COMPLETED':
                logger.info("Transcription job completed.")
                # The transcription output is written as <unique_job_name>.json in the bucket root.
                actual_output_key = f"{unique_job_name}.json"
                
                # Construct the transcript key in the patient folder.
                base_name, _ = os.path.splitext(file_name)
                transcript_file_name = f"{base_name}.json"
                transcript_key = f"id_{patient_id}/{transcript_file_name}"
                
                # Copy the transcript to the patient folder.
                s3_client.copy_object(
                    Bucket=S3_BUCKET,
                    CopySource={'Bucket': S3_BUCKET, 'Key': actual_output_key},
                    Key=transcript_key
                )
                
                # Delete the original transcript file from the bucket root.
                s3_client.delete_object(Bucket=S3_BUCKET, Key=actual_output_key)
                
                # Fetch and return the transcript from the patient folder.
                return fetch_transcript_from_s3(S3_BUCKET, transcript_key)
            elif status == 'FAILED':
                return {
                    'statusCode': 500,
                    'headers': {'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({"error": "Transcription job failed."})
                }
            
            time.sleep(poll_interval)
            elapsed += poll_interval
        
        # If timeout is reached.
        return {
            'statusCode': 504,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({"error": "Transcription job timed out."})
        }
    
    except Exception as e:
        logger.exception("Unhandled exception in lambda_handler")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({"error": str(e)})
        }

def fetch_transcript_from_s3(bucket_name, object_key):
    """
    Fetches the transcript JSON file from S3 and returns the transcript text.
    """
    s3_client = boto3.client('s3')
    
    try:
        response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
        transcript_json = json.loads(response['Body'].read().decode('utf-8'))
        transcript_list = transcript_json.get('results', {}).get('transcripts', [])
        transcript_text = transcript_list[0]['transcript'] if transcript_list else ""
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({"transcript": transcript_text})
        }
    
    except Exception as e:
        logger.exception("Error retrieving transcript from S3")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({"error": f"Error retrieving transcript from S3: {str(e)}"})
        }
