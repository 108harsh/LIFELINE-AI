import os
from groq import Groq
from dotenv import load_dotenv

# Load the local env file
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env.local'))

from backend.services.location_services import get_nearest_hospital

def get_first_aid_guidance(emergency_type: str, lat: float = None, lng: float = None) -> dict:
    """
    Generates immediate, step-by-step first aid guidance based on the emergency type.
    Finds the nearest hospital and injects it into the prompt.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    # Clean up any potential accidental whitespace or quotes from the .env file
    if api_key:
        api_key = api_key.strip().strip("'\"").strip()
    
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is missing")
        
    client = Groq(api_key=api_key)
    
    # Optional logic for retrieving hospital
    hospital = None
    if lat is not None and lng is not None:
        hospital = get_nearest_hospital(lat, lng)
    
    hospital_name = hospital["name"] if hospital else "Emergency Services"
    hospital_phone = hospital["phone"] if hospital else "108"
    
    system_prompt = (
        f"Emergency detected. Nearest hospital is {hospital_name}, Phone: {hospital_phone}. "
        "Provide 3 short action bullet points, and explicitly tell them to call this specific hospital in the first point."
    )
    
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": emergency_type}
        ],
        temperature=0.2, # Keep hallucination risk low for medical advice
        max_tokens=100, # Constrain the length forcefully
    )
    
    guidance_text = response.choices[0].message.content
    
    result = {"guidance": guidance_text}
    if hospital:
        result["hospital"] = hospital
    return result
