import requests
import json

def get_nearest_hospital(lat: float, lng: float) -> dict:
    """
    Finds the nearest hospital using the free Overpass API.
    Retrieves the hospital's name, phone, and coordinates.
    """
    overpass_url = "http://overpass-api.de/api/interpreter"
    overpass_query = f"""
    [out:json];
    node['amenity'='hospital'](around:5000,{lat},{lng});
    out 1;
    """
    
    try:
        response = requests.post(overpass_url, data={'data': overpass_query}, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if 'elements' in data and len(data['elements']) > 0:
            hospital = data['elements'][0]
            tags = hospital.get('tags', {})
            
            return {
                "name": tags.get('name', 'Nearest Hospital'),
                "phone": tags.get('phone', tags.get('contact:phone', '108')),
                "lat": hospital.get('lat', lat),
                "lng": hospital.get('lon', lng)
            }
    except Exception as e:
        print(f"Failed to fetch hospital from Overpass API: {e}")
        
    # Fallback if the API fails or no hospital is found nearby
    return {
        "name": "General Emergency Room",
        "phone": "108",
        "lat": lat,
        "lng": lng
    }
