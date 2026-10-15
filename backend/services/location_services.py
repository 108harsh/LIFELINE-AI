import requests
import json

def get_nearby_medical_services(lat: float, lng: float) -> dict:
    """
    Finds the nearest hospital and nearby pharmacies using Overpass API.
    Returns hospital details and pharmacy markers list.
    """
    overpass_url = "http://overpass-api.de/api/interpreter"
    
    # Combined Overpass QL query for hospitals and pharmacies within 5km radius
    overpass_query = f"""
    [out:json];
    (
      node['amenity'='hospital'](around:5000,{lat},{lng});
      node['amenity'='pharmacy'](around:5000,{lat},{lng});
    );
    out 10;
    """
    
    hospital = None
    pharmacies = []
    
    try:
        headers = {'User-Agent': 'LifeLineAI/1.0 (EmergencyResponseApp)'}
        response = requests.post(overpass_url, data={'data': overpass_query}, headers=headers, timeout=8)
        response.raise_for_status()
        data = response.json()
        
        if 'elements' in data:
            for elem in data['elements']:
                tags = elem.get('tags', {})
                amenity_type = tags.get('amenity')
                name = tags.get('name', 'Medical Facility')
                phone = tags.get('phone', tags.get('contact:phone', '108'))
                elem_lat = elem.get('lat', lat)
                elem_lng = elem.get('lon', lng)
                
                if amenity_type == 'hospital' and not hospital:
                    hospital = {
                        "name": name,
                        "phone": phone,
                        "lat": elem_lat,
                        "lng": elem_lng
                    }
                elif amenity_type == 'pharmacy' and len(pharmacies) < 4:
                    pharmacies.append({
                        "name": name,
                        "phone": phone,
                        "lat": elem_lat,
                        "lng": elem_lng
                    })
    except Exception as e:
        print(f"Failed to fetch medical services from Overpass API: {e}")
        
    if not hospital:
        hospital = {
            "name": "General Emergency Room",
            "phone": "108",
            "lat": lat + 0.008,
            "lng": lng + 0.008
        }
        
    if not pharmacies:
        # Fallback nearby pharmacies for visual demo if API fails
        pharmacies = [
            {"name": "Apollo Pharmacy (24/7)", "phone": "1860-500-0101", "lat": lat + 0.003, "lng": lng + 0.004},
            {"name": "MedPlus Chemist", "phone": "040-67006700", "lat": lat - 0.002, "lng": lng - 0.003}
        ]
        
    return {
        "hospital": hospital,
        "pharmacies": pharmacies
    }

def get_nearest_hospital(lat: float, lng: float) -> dict:
    services = get_nearby_medical_services(lat, lng)
    return services["hospital"]


def find_astar_route(start_lat: float, start_lng: float, end_lat: float, end_lng: float) -> list:
    """
    Downloads the street network around the start location using Overpass API,
    constructs a routing graph, and runs A* pathfinding algorithm to calculate
    the shortest path to the destination hospital.
    """
    import math
    import heapq
    
    overpass_url = "http://overpass-api.de/api/interpreter"
    
    # Query for highways/roads within 3km of the start location
    query = f"""
    [out:json];
    (
      way["highway"](around:3000,{start_lat},{start_lng});
    );
    (._;>;);
    out body;
    """
    
    try:
        headers = {'User-Agent': 'LifeLineAI/1.0 (EmergencyResponseApp)'}
        response = requests.post(overpass_url, data={'data': query}, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"Failed to fetch road network for A* routing: {e}")
        # Fallback to straight line path
        return [[start_lat, start_lng], [end_lat, end_lng]]
        
    elements = data.get('elements', [])
    
    # 1. Parse nodes
    nodes = {} # id -> (lat, lon)
    for elem in elements:
        if elem.get('type') == 'node':
            nodes[elem['id']] = (elem['lat'], elem['lon'])
            
    # 2. Parse ways (edges)
    adj = {} # node_id -> set of neighbor node_ids
    for elem in elements:
        if elem.get('type') == 'way' and 'nodes' in elem:
            way_nodes = elem['nodes']
            for i in range(len(way_nodes) - 1):
                u = way_nodes[i]
                v = way_nodes[i+1]
                if u in nodes and v in nodes:
                    if u not in adj: adj[u] = set()
                    if v not in adj: adj[v] = set()
                    adj[u].add(v)
                    adj[v].add(u) # Undirected graph for roads
                    
    if not nodes or not adj:
        # Fallback if no roads parsed
        return [[start_lat, start_lng], [end_lat, end_lng]]
        
    # 3. Find closest nodes in the graph to start and end coordinates
    def get_closest_node(lat, lng):
        closest_id = None
        min_dist = float('inf')
        for node_id, (n_lat, n_lng) in nodes.items():
            dist = (n_lat - lat)**2 + (n_lng - lng)**2
            if dist < min_dist:
                min_dist = dist
                closest_id = node_id
        return closest_id
        
    start_node = get_closest_node(start_lat, start_lng)
    end_node = get_closest_node(end_lat, end_lng)
    
    if start_node is None or end_node is None:
        return [[start_lat, start_lng], [end_lat, end_lng]]
        
    # 4. A* algorithm
    # Heuristic function: straight-line distance to end node
    def heuristic(node_id):
        n_lat, n_lng = nodes[node_id]
        end_lat_val, end_lng_val = nodes[end_node]
        return math.sqrt((n_lat - end_lat_val)**2 + (n_lng - end_lng_val)**2)
        
    pq = []
    # Push (f_score, g_score, node_id, path)
    heapq.heappush(pq, (heuristic(start_node), 0.0, start_node, [start_node]))
    
    visited = {} # node_id -> best g_score
    
    found_path = None
    
    while pq:
        f, g, u, path = heapq.heappop(pq)
        
        if u == end_node:
            found_path = path
            break
            
        if u in visited and visited[u] <= g:
            continue
        visited[u] = g
        
        u_lat, u_lng = nodes[u]
        
        neighbors = adj.get(u, [])
        for v in neighbors:
            v_lat, v_lng = nodes[v]
            # Edge weight is physical distance between u and v
            weight = math.sqrt((u_lat - v_lat)**2 + (u_lng - v_lng)**2)
            g_new = g + weight
            
            if v not in visited or g_new < visited[v]:
                f_new = g_new + math.sqrt((v_lat - nodes[end_node][0])**2 + (v_lng - nodes[end_node][1])**2)
                heapq.heappush(pq, (f_new, g_new, v, path + [v]))
                
    if found_path:
        # Convert node IDs to lat/lng list
        coordinates = []
        coordinates.append([start_lat, start_lng]) # Start from exactly the incident coordinates
        for node_id in found_path:
            coordinates.append(list(nodes[node_id]))
        coordinates.append([end_lat, end_lng]) # End exactly at the hospital coordinates
        return coordinates
        
    # Fallback to straight line
    return [[start_lat, start_lng], [end_lat, end_lng]]

