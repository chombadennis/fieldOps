import httpx
import asyncio

async def test_fetch_projects():
    base_url = "http://127.0.0.1:8000/api"
    print("1. Fetching all projects...")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Test 1: List Projects
            response = await client.get(f"{base_url}/projects")
            print(f"List Projects Code: {response.status_code}")
            if response.status_code == 200:
                projects = response.json()
                print(f"Success! Retrieved {len(projects)} projects.")
            else:
                print(f"Failed list projects! {response.status_code}")
                return

            # Test 2: Get Project Details (with boq_documents)
            print("\n2. Fetching project 9999 details...")
            response = await client.get(f"{base_url}/projects/9999")
            print(f"Project 9999 Code: {response.status_code}")
            if response.status_code == 200:
                project = response.json()
                boq_docs = project.get("boq_documents", [])
                print(f"Success! Project name: {project.get('name')}")
                print(f"Found {len(boq_docs)} attached BOQ documents:")
                for doc in boq_docs:
                    print(f"  - Document: {doc.get('name')} | Origin: {doc.get('origin')}")
                
                # Test 3: Get items of the first BOQ document
                if len(boq_docs) > 0:
                    boq_id = boq_docs[0]["id"]
                    boq_name = boq_docs[0]["name"]
                    print(f"\n3. Fetching items for BOQ '{boq_name}' (ID {boq_id})...")
                    response = await client.get(f"{base_url}/boqs/{boq_id}/items")
                    print(f"BOQ Items Code: {response.status_code}")
                    if response.status_code == 200:
                        items = response.json()
                        print(f"Success! Retrieved {len(items)} items from the BOQ.")
                        if len(items) > 0:
                            first_item = items[0]
                            print(f"Sample item: [No: {first_item.get('bill_item_number')}] {first_item.get('description')[:60]}...")
                            
                            # Test 4: Bulk Update BOQ Items
                            print(f"\n4. Simulating inline edit and bulk saving for BOQ ID {boq_id}...")
                            # Modify description of first item slightly
                            original_desc = first_item["description"]
                            first_item["description"] = original_desc + " (Verified)"
                            
                            put_response = await client.put(f"{base_url}/boqs/{boq_id}/items", json=items)
                            print(f"PUT Response Code: {put_response.status_code}")
                            if put_response.status_code == 200:
                                print(f"Success! Bulk update returned: {put_response.json()}")
                            else:
                                print(f"Failure updating BOQ items: {put_response.status_code}")
                                print(put_response.text)
                            
                            # Reset item description back to normal
                            first_item["description"] = original_desc
                            await client.put(f"{base_url}/boqs/{boq_id}/items", json=items)
                    else:
                        print(f"Failed retrieving BOQ items: {response.status_code}")
                else:
                    print("Warning: No BOQ documents linked to this project yet. Try uploading one!")
            else:
                print(f"Failed fetching project details: {response.status_code}")
                
    except Exception as e:
        import traceback
        print(f"Connection/execution failed.")
        print(f"Error Type: {type(e)}")
        print(f"Error Representation: {repr(e)}")
        print("Traceback:")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_fetch_projects())
