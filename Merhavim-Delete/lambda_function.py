import json
import boto3

def lambda_handler(event, context):
    try:
        # --- CORS Preflight Handling ---
        if event.get('httpMethod', '') == 'OPTIONS':
            return {
                "statusCode": 200,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "DELETE,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,Authorization"
                },
                "body": ""
            }
        
        # 1. Parse request parameters (from pathParameters or queryStringParameters)
        patient_id = None
        file_name = None

        if event.get('pathParameters'):
            patient_id = event['pathParameters'].get('patientId')
            file_name = event['pathParameters'].get('fileName')

        if event.get('queryStringParameters'):
            qs_params = event['queryStringParameters']
            if not patient_id:
                patient_id = qs_params.get('patientId')
            if not file_name:
                # support both "fileName" and "filename"
                file_name = qs_params.get('fileName') or qs_params.get('filename')

        # Ensure patient_id is provided
        if not patient_id:
            raise ValueError("Missing patientId")

        bucket = 'merhavim-patients-folder'
        s3 = boto3.client('s3')
        
        if file_name:
            # Delete a single file
            s3_key = f"id_{patient_id}/{file_name}"
            print("Request received: Deleting file/object with key:", s3_key)
            response = s3.delete_object(
                Bucket=bucket,
                Key=s3_key
            )
            print("Delete response:", response)
        else:
            # Delete a directory recursively (all objects with the prefix id_{patient_id}/)
            prefix = f"id_{patient_id}/"
            print("Request received: Recursively deleting all objects with prefix:", prefix)
            
            paginator = s3.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=bucket, Prefix=prefix)
            
            objects_to_delete = []
            for page in pages:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        objects_to_delete.append({'Key': obj['Key']})
            
            if objects_to_delete:
                # S3 allows deleting up to 1000 objects per batch
                for i in range(0, len(objects_to_delete), 1000):
                    chunk = objects_to_delete[i:i+1000]
                    delete_response = s3.delete_objects(
                        Bucket=bucket,
                        Delete={'Objects': chunk}
                    )
                    print(f"Deleted chunk ({i} to {i+len(chunk)}):", delete_response)
            else:
                print("No objects found with prefix:", prefix)

        # Return a success response with CORS headers
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "DELETE,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
                "Content-Type": "application/json"
            },
            "body": json.dumps({"message": "Delete operation completed successfully"})
        }

    except Exception as e:
        print("Error:", str(e))
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "DELETE,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type,Authorization"
            },
            "body": json.dumps({"message": str(e)})
        }
