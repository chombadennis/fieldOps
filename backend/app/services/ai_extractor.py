from .ai_client import generate_text
import json
import logging
import re

logger = logging.getLogger(__name__)

async def get_ai_extraction(text: str) -> dict:
    """
    Given a text representation of a Bill of Quantities, this function
    uses the centralized AI client to extract structured data asynchronously.
    """
    prompt = f"""
    You are an expert system designed for construction and civil engineering projects.
    Your task is to analyze the following Bill of Quantities (BOQ) data and extract the line items.
    
    Please process the data and return a structured JSON object. The JSON object must have a single root key called "boq_items".
    The value of "boq_items" should be a list of objects, where each object represents a line item.
    
    For each line item, extract the following fields:
    - "description": The detailed description of the work or material.
    - "quantity": The numerical quantity of the item. This should be a float or integer.
    - "unit": The unit of measurement (e.g., 'sqm', 'nos', 'kg', 'cum').
    - "rate": The cost per unit. This should be a float or integer.
    - "amount": The total cost for the item (quantity * rate). This should be a float or integer.

    Here is the BOQ data to be processed:
    ---
    {text}
    ---

    Important Instructions:
    1. Return ONLY the JSON object. Do not include any introductory text, explanations, or markdown code fences (```json ... ```).
    2. If a value is not present for a field (e.g., 'rate' is missing), set its value to null.
    3. Ensure the output is a single, valid JSON object.
    """

    response = await generate_text(prompt)

    if "error" in response:
        logger.error(f"AI service returned an error: {response['error']}")
        return {"error": response["error"]}

    raw_text = response.get("text", "")

    try:
        # Attempt to find and parse the JSON blob from the response text
        # This regex is more robust than find/rfind and handles nested structures.
        match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if not match:
            logger.error("AI response did not contain a valid JSON object.")
            return {"error": "Failed to find JSON in AI response.", "raw_response": raw_text}

        json_str = match.group(0)
        extracted_data = json.loads(json_str)

        # Basic validation of the parsed structure
        if "boq_items" not in extracted_data or not isinstance(extracted_data["boq_items"], list):
             logger.error(f'JSON from AI is missing the "boq_items" list. Found keys: {list(extracted_data.keys())}')
             return {"error": 'The AI response had an invalid structure. It must contain a "boq_items" list.', "raw_response": raw_text}

        logger.info(f"Successfully parsed {len(extracted_data['boq_items'])} items from BOQ using {response.get('source')}.")
        return {"extracted_data": extracted_data, "source": response.get("source")}

    except json.JSONDecodeError as e:
        logger.error(f"Failed to decode JSON from AI response: {e}")
        return {"error": "Failed to parse AI response as JSON.", "raw_response": raw_text}
    except Exception as e:
        logger.error(f"An unexpected error occurred during AI response processing: {e}")
        return {"error": "An unexpected error occurred during AI response processing.", "raw_response": raw_text}
