import os
import json
import base64
import tempfile
import torch
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from transformers import BertTokenizer, BertForSequenceClassification
from PyPDF2 import PdfReader

# Define the label mapping (same as in your training script)
LABEL_MAPPING = {
    0: 'INFORMATION-TECHNOLOGY',
    1: 'ENGINEERING',
    2: 'AUTOMOBILE',
    3: 'BUSINESS-DEVELOPMENT',
    4: 'ACCOUNTANT',
    5: 'FINANCE',
    6: 'SALES',
    7: 'BANKING',
    8: 'CONSULTANT',
    9: 'ADVOCATE',
    10: 'CHEF',
    11: 'FITNESS',
    12: 'HEALTHCARE',
    13: 'AVIATION',
    14: 'PUBLIC-RELATIONS',
    15: 'DIGITAL-MEDIA',
    16: 'HR',
    17: 'TEACHER',
    18: 'DESIGNER',
    19: 'CONSTRUCTION',
    20: 'APPAREL',
    21: 'AGRICULTURAL',
    22: 'BPO',
23:'ARTS'
}


# Model and tokenizer setup
MODEL_PATH = "C:/Users/vinay/Desktop/asims_classifi/ClassiFI/model_weights/fourth_iteration_24"
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
model = BertForSequenceClassification.from_pretrained(MODEL_PATH)
model.eval()

def is_valid_base64(base64_str):
    """
    Validate base64 encoded string.
    
    Args:
        base64_str (str): Base64 encoded string
    
    Returns:
        bool: True if valid base64, False otherwise
    """
    try:
        base64.b64decode(base64_str, validate=True)
        return True
    except Exception:
        return False

def extract_text_from_base64_pdf(base64_pdf):
    """
    Extract text from a base64 encoded PDF file.
    
    Args:
        base64_pdf (str): Base64 encoded PDF content
    
    Returns:
        str: Extracted text from the PDF
    """
    try:
        # Decode base64 to bytes
        pdf_bytes = base64.b64decode(base64_pdf)
        
        # Try multiple encodings
        encodings_to_try = ['utf-8', 'latin-1', 'utf-16', 'windows-1252']
        
        for encoding in encodings_to_try:
            try:
                # Create a temporary file
                with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_pdf:
                    temp_pdf.write(pdf_bytes)
                    temp_pdf_path = temp_pdf.name
                
                # Read PDF
                reader = PdfReader(temp_pdf_path)
                text = ""
                for page in reader.pages:
                    text += page.extract_text()
                
                # Clean up temporary file
                os.unlink(temp_pdf_path)
                
                return text
            except UnicodeDecodeError:
                continue
        
        return ""
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
        return ""

def predict_resume_category(resume_text):
    """
    Predict the category of a resume.
    
    Args:
        resume_text (str): Text content of the resume
    
    Returns:
        str: Predicted category
    """
    try:
        # Tokenize the input
        inputs = tokenizer(
            resume_text, 
            return_tensors="pt", 
            truncation=True, 
            padding=True, 
            max_length=512
        )
        
        # Get model prediction
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits
        
        # Get the predicted class
        predicted_class_id = torch.argmax(logits, dim=1).item()
        return LABEL_MAPPING.get(predicted_class_id, 'OTHERS')
    
    except Exception as e:
        print(f"Prediction error: {e}")
        return 'UNKNOWN'

@csrf_exempt
@require_http_methods(["POST"])
@csrf_exempt
@require_http_methods(["POST"])
def classify_resume4(request):
    if request.method == 'POST':
        # Check if file is present
        if 'resume' not in request.FILES:
            return JsonResponse({
                'error': 'No resume file uploaded',
                'status': 'fail'
            }, status=400)
        
        # Get the uploaded file
        resume_file = request.FILES['resume']
        
        # Validate file type (optional but recommended)
        if not resume_file.name.lower().endswith('.pdf'):
            return JsonResponse({
                'error': 'Only PDF files are allowed',
                'status': 'fail'
            }, status=400)
        
        try:
            # Read the file content
            resume_content = resume_file.read()
            
            # Convert to base64
            resume_base64 = base64.b64encode(resume_content).decode('utf-8')
            
            # Extract text from base64 PDF
            resume_text = extract_text_from_base64_pdf(resume_base64)
            
            # Check if text extraction was successful
            if not resume_text.strip():
                return JsonResponse({
                    'error': 'Could not extract text from PDF', 
                    'status': 'fail',
                    'details': 'PDF may be empty, corrupted, or in an unsupported format'
                }, status=400)
            
            # Predict category
            predicted_category = predict_resume_category(resume_text)
            
            # Return prediction
            return JsonResponse({
                'category': predicted_category,
                'status': 'success'
            })
        
        except Exception as e:
            return JsonResponse({
                'error': 'Processing error', 
                'status': 'fail',
                'details': str(e)
            }, status=500)
    
    # Handle non-POST requests
    return JsonResponse({
        'error': 'Method not allowed',
        'status': 'fail'
    }, status=405)