import os
from groq import Groq
from dotenv import load_dotenv

# Load the local env file
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env.local'))

from backend.services.location_services import get_nearby_medical_services

def get_fallback_guidance(emergency_type: str, hospital_name: str, hospital_phone: str) -> str:
    """
    Intelligent offline fallback guidance generator based on emergency type.
    """
    t = emergency_type.lower()
    if "cardiac" in t or "heart" in t:
        return (
            f"1. Call {hospital_name} at {hospital_phone} immediately.\n"
            "2. Check if the patient is breathing and responsive. If unresponsive, start CPR chest compressions (100-120/min).\n"
            "3. Search for an Automated External Defibrillator (AED) and follow its voice instructions."
        )
    elif "fall" in t or "collapse" in t or "lying down" in t or "lie down" in t:
        return (
            f"1. Call {hospital_name} at {hospital_phone} or emergency services immediately.\n"
            "2. Do NOT move the victim to prevent spinal injury. Check if they are breathing.\n"
            "3. If conscious, keep them calm and warm. If unconscious but breathing, place in recovery position."
        )
    elif "trauma" in t or "traffic" in t or "accident" in t:
        return (
            f"1. Call {hospital_name} at {hospital_phone} for emergency assistance.\n"
            "2. Do NOT move the victim unless in immediate danger to avoid spinal injury.\n"
            "3. Keep the victim warm, calm, and monitor breathing until paramedics arrive."
        )
    elif "choking" in t:
        return (
            f"1. Call {hospital_name} at {hospital_phone} immediately.\n"
            "2. Perform abdominal thrusts (Heimlich maneuver) if conscious.\n"
            "3. If victim loses consciousness, start CPR and inspect airway."
        )
    else:
        return (
            f"1. Call {hospital_name} at {hospital_phone} for immediate medical response.\n"
            "2. Ensure the emergency site is safe and keep the patient calm and comfortable.\n"
            "3. Monitor vital signs continuously until emergency teams reach the location."
        )

def get_first_aid_guidance(emergency_type: str, lat: float = None, lng: float = None) -> dict:
    """
    Generates immediate, step-by-step first aid guidance based on the emergency type.
    Finds the nearest hospital & medical pharmacies, calculates the A* route, and injects them.
    """
    hospital = None
    pharmacies = []
    if lat is not None and lng is not None:
        services = get_nearby_medical_services(lat, lng)
        hospital = services.get("hospital")
        pharmacies = services.get("pharmacies", [])
    
    hospital_name = hospital["name"] if hospital else "Emergency Services"
    hospital_phone = hospital["phone"] if hospital else "108"

    # Calculate A* shortest path route to hospital if coordinates are present
    route = []
    if lat is not None and lng is not None and hospital:
        from backend.services.location_services import find_astar_route
        try:
            route = find_astar_route(lat, lng, hospital["lat"], hospital["lng"])
        except Exception as route_e:
            print("Failed to calculate A* shortest path:", route_e)
            route = [[lat, lng], [hospital["lat"], hospital["lng"]]]

    api_key = os.environ.get("GROQ_API_KEY")
    if api_key:
        api_key = api_key.strip().strip("'\"").strip()
    
    if not api_key or api_key == "your_groq_api_key_here":
        guidance_text = get_fallback_guidance(emergency_type, hospital_name, hospital_phone)
        result = {"guidance": guidance_text}
        if hospital:
            result["hospital"] = hospital
        if pharmacies:
            result["pharmacies"] = pharmacies
        if route:
            result["route"] = route
        return result

    try:
        client = Groq(api_key=api_key)
        
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
    except Exception as e:
        print(f"Groq API call error, falling back to local guidance: {e}")
        guidance_text = get_fallback_guidance(emergency_type, hospital_name, hospital_phone)
    
    result = {"guidance": guidance_text}
    if hospital:
        result["hospital"] = hospital
    if pharmacies:
        result["pharmacies"] = pharmacies
    if route:
        result["route"] = route
    return result
