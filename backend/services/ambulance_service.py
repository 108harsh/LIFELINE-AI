import os
from dotenv import load_dotenv

# Load env variables from .env.local
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env.local'))

class AmbulanceService:
    def __init__(self):
        self.account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        self.auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
        self.from_phone = os.environ.get("TWILIO_PHONE_NUMBER")
        self.to_phone = os.environ.get("EMERGENCY_RECIPIENT_PHONE")
        
        # Strip outer quotes if any
        if self.account_sid: self.account_sid = self.account_sid.strip().strip("'\"")
        if self.auth_token: self.auth_token = self.auth_token.strip().strip("'\"")
        if self.from_phone: self.from_phone = self.from_phone.strip().strip("'\"")
        if self.to_phone: self.to_phone = self.to_phone.strip().strip("'\"")
        
        self.is_configured = bool(self.account_sid and self.auth_token and self.from_phone and self.to_phone)
        
    def request_ambulance(self, incident_id: str, lat: float, lng: float) -> dict:
        """
        Dispatches an ambulance by sending an SMS alert to emergency services/contacts with GPS link.
        """
        maps_link = f"https://www.google.com/maps?q={lat},{lng}"
        message_body = (
            f"🚨 EMERGENCY ALERT: Medical Collapse Suspected!\n"
            f"Incident: {incident_id}\n"
            f"GPS Location: Lat {lat}, Lng {lng}\n"
            f"Maps Link: {maps_link}\n"
            f"Please dispatch an ambulance unit immediately!"
        )
        
        if not self.is_configured:
            print("Ambulance Service [SANDBOX]: Twilio credentials not configured. SMS not sent.")
            return {
                "success": True,
                "sandbox": True,
                "message": "Ambulance requested in Sandbox/Demo mode.",
                "sms_body": message_body,
                "dispatch_status": "dispatched",
                "eta_mins": 4,
                "api_status": "Twilio credentials not set in .env.local"
            }
            
        try:
            from twilio.rest import Client
            client = Client(self.account_sid, self.auth_token)
            sms = client.messages.create(
                body=message_body,
                from_=self.from_phone,
                to=self.to_phone
            )
            print(f"Ambulance Service: SMS Sent successfully. SID: {sms.sid}")
            return {
                "success": True,
                "sandbox": False,
                "message": "Ambulance request dispatched via Twilio SMS!",
                "sms_body": message_body,
                "dispatch_status": "dispatched",
                "eta_mins": 4,
                "sms_sid": sms.sid
            }
        except Exception as e:
            print(f"Ambulance Service Error: Failed to send SMS: {e}")
            return {
                "success": False,
                "sandbox": False,
                "message": f"Failed to send dispatch SMS: {str(e)}",
                "dispatch_status": "failed",
                "eta_mins": None
            }

ambulance_service = AmbulanceService()
