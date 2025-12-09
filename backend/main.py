from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import chromadb
import ollama
import json
from typing import List, Optional, Dict
import os
from pathlib import Path
import traceback
import hashlib
from contextlib import asynccontextmanager
import traceback
from datetime import datetime
import uuid

pending_solutions: Dict[str, dict] = {}  # In-memory storage for demo
reviewed_solutions: Dict[str, dict] = {}

# Configuration - just set the path to your Excel file - can create a config file and move these hardcoded paths theer or an env file
DATABASE_FILE_PATH = "./data/technology_database.xlsx"

# Globals
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = None
tech_df = None
db_metadata_file = Path("./chroma_db/database_metadata.json")

class SolutionSubmission(BaseModel):
    submission_id: str
    challenge: dict
    solutions: List[dict]
    submitted_at: str
    status: str

class ReviewAction(BaseModel):
    action: str  # "approve" or "reject"
    feedback: Optional[str] = None

# keep track of changes to the excel file
def get_file_hash(file_path: str) -> str:
    """Generate MD5 hash of file to detect changes"""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()


def load_metadata() -> dict:
    """Load metadata about the last processed database"""
    if db_metadata_file.exists():
        with open(db_metadata_file, 'r') as f:
            return json.load(f)
    return {}


def save_metadata(file_hash: str, tech_count: int):
    """Save metadata about the processed database"""
    db_metadata_file.parent.mkdir(exist_ok=True)
    metadata = {
        'file_hash': file_hash,
        'technology_count': tech_count,
        'last_updated': pd.Timestamp.now().isoformat()
    }
    with open(db_metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2)


def load_technology_database():
    """Load and index the technology database (with caching)"""
    global tech_df, collection
    
    if not Path(DATABASE_FILE_PATH).exists():
        print(f"❌ Database file not found at: {DATABASE_FILE_PATH}")
        return 0
    
    file_hash = get_file_hash(DATABASE_FILE_PATH)
    metadata = load_metadata()
    
    # Check if we can skip re-embedding
    if metadata.get('file_hash') == file_hash:
        print("📦 File unchanged - loading existing embeddings...")
        
        tech_df = pd.read_excel(DATABASE_FILE_PATH)
        tech_df.columns = tech_df.columns.str.strip()
        
        if 'Does the Technology still exist?' in tech_df.columns:
            tech_df = tech_df[
                tech_df['Does the Technology still exist?']
                .fillna('')
                .astype(str)
                .str.lower()
                .isin(['yes', 'y', 'true'])
            ].copy()  # Use .copy() to avoid SettingWithCopyWarning
        
        # after removing the non-existing tech, need to reset the index
        # ⭐ Reset index after filtering
        tech_df.reset_index(drop=True, inplace=True)
        
        try:
            collection = chroma_client.get_collection(name="technologies")
            print(f"✅ Loaded {len(tech_df)} technologies from cache (indices: 0-{len(tech_df)-1})")
            return len(tech_df)
        except:
            print("⚠️  Collection not found, will re-embed...")
    
    # if Re-embedding is requyired
    print("🔄 Embedding technologies...")
    
    tech_df = pd.read_excel(DATABASE_FILE_PATH)
    tech_df.columns = tech_df.columns.str.strip()
    
    # if re embededding, again remove the non-existing tech
    if 'Does the Technology still exist?' in tech_df.columns:
        tech_df = tech_df[
            tech_df['Does the Technology still exist?']
            .fillna('')
            .astype(str)
            .str.lower()
            .isin(['yes', 'y', 'true'])
        ].copy()
    
    # ⭐ Reset index after filtering
    tech_df.reset_index(drop=True, inplace=True)
    
    try:
        chroma_client.delete_collection("technologies")
    except:
        pass
    
    collection = chroma_client.create_collection(
        name="technologies",
        metadata={"description": "NZTC Technology Database"}
    )
    
    documents = []
    metadatas = []
    ids = []
    
    # Now idx is guaranteed to be 0, 1, 2, 3... matching DataFrame (was having an issue earlier on)
    for idx, row in tech_df.iterrows():
        doc_text = f"""
        Technology: {row.get('Title', 'N/A')}
        Provider: {row.get('Technology Provider', 'N/A')}
        Description: {row.get('Technology Description', 'N/A')}
        Category: {row.get('Category', 'N/A')}
        Sub-Category: {row.get('Sub-Category', 'N/A')}
        TRL: {row.get('TRL', 'N/A')}
        Additional Info: {row.get('Technology Comments/ Additional Info.', 'N/A')}
        """
        
        documents.append(doc_text)
        metadatas.append({
            'tech_id': str(idx),
            'title': str(row.get('Title', 'N/A')),
            'provider': str(row.get('Technology Provider', 'N/A')),
            'category': str(row.get('Category', 'N/A')),
            'sub_category': str(row.get('Sub-Category', 'N/A')),
            'trl': str(row.get('TRL', 'N/A'))
        })
        ids.append(f"tech_{idx}")
    
    collection.add(
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )
    
    save_metadata(file_hash, len(tech_df))
    print(f"✅ Embedded {len(tech_df)} technologies (indices: 0-{len(tech_df)-1})")
    return len(tech_df)




@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load database on startup"""
    print("=" * 60)
    print("🚀 NZTC Innovation Co-Pilot Starting")
    print("=" * 60)
    
    # Check Ollama
    try:
        ollama.list()
        print("✅ Ollama connected")
    except Exception as e:
        print(f"⚠️  Ollama not available: {e}")
    
    # Load database
    try:
        count = load_technology_database()
        if count > 0:
            print(f"✅ Database ready: {count} technologies")
        else:
            print(f"⚠️  Place Excel file at: {DATABASE_FILE_PATH}")
    except Exception as e:
        print(f"❌ Database error: {e}")
        traceback.print_exc()
    
    print("=" * 60)
    print(f"🌐 Server ready at http://localhost:8001")
    print("=" * 60)
    
    yield


app = FastAPI(title="NZTC Innovation Co-Pilot API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# models
class ChallengeInput(BaseModel):
    challenge_description: str
    industry_sector: Optional[str] = None
    emissions_baseline: Optional[float] = None
    target_reduction: Optional[float] = None
    timeline_months: Optional[int] = None
    budget_range: Optional[str] = None
    constraints: Optional[List[str]] = []


class TechnologyMatch(BaseModel):
    tech_id: str
    title: str
    provider: str
    description: str
    trl: str
    category: str
    sub_category: str
    relevance_score: float
    reasoning: str


class Solution(BaseModel):
    solution_id: int
    title: str
    technologies: List[TechnologyMatch]
    description: str
    how_it_works: str
    benefits: List[str]
    integration_considerations: List[str]
    feasibility: str
    timeline_estimate: str
    estimated_cost_range: str


class SolutionResponse(BaseModel):
    solutions: List[Solution]
    processing_time: float
    technologies_analyzed: int
    submission_id: Optional[str] = None


# query_relevant_technologies and generate_solutions_with_llm functions
def query_relevant_technologies(challenge: str, n_results: int = 15) -> List[dict]:
    """Query ChromaDB for relevant technologies"""
    if collection is None:
        raise HTTPException(status_code=500, detail="Technology database not loaded")
    
    try:
        results = collection.query(
            query_texts=[challenge],
            n_results=min(n_results, len(tech_df))
        )
        
        technologies = []
        max_idx = len(tech_df) - 1
        
        for i in range(len(results['ids'][0])):
            tech_id_str = results['metadatas'][0][i]['tech_id']
            tech_id = int(tech_id_str)
            
            # Safety check
            if tech_id > max_idx:
                print(f"⚠️ Skipping invalid tech_id {tech_id} (max: {max_idx})")
                continue
            
            tech_row = tech_df.iloc[tech_id]
            
            technologies.append({
                'tech_id': tech_id_str,
                'title': tech_row.get('Title', 'N/A'),
                'provider': tech_row.get('Technology Provider', 'N/A'),
                'description': tech_row.get('Technology Description', 'N/A'),
                'trl': str(tech_row.get('TRL', 'N/A')),
                'category': tech_row.get('Category', 'N/A'),
                'sub_category': tech_row.get('Sub-Category', 'N/A'),
                'distance': results['distances'][0][i]
            })
        
        return technologies
        
    except Exception as e:
        print(f"❌ Query Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

def extract_json_from_text(text: str) -> str:
    """Robustly extract JSON from text with potential extra content"""
    # Find first opening brace
    start = text.find('{')
    if start == -1:
        raise ValueError("No JSON object found in text")
    
    # Count braces to find matching closing brace
    brace_count = 0
    in_string = False
    escape_next = False
    
    for i in range(start, len(text)):
        char = text[i]
        
        # Handle string escaping
        if escape_next:
            escape_next = False
            continue
        
        if char == '\\':
            escape_next = True
            continue
        
        # Track if we're inside a string
        if char == '"':
            in_string = not in_string
            continue
        
        # Only count braces outside strings
        if not in_string:
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                
                # Found matching closing brace
                if brace_count == 0:
                    return text[start:i+1]
    
    raise ValueError("No complete JSON object found")


def generate_solutions_with_llm(challenge_input: ChallengeInput, relevant_techs: List[dict]) -> List[Solution]:
    """Use Ollama to generate solution combinations"""
    
    tech_context = "\n\n".join([
        f"Technology {tech['tech_id']}:\n"
        f"- Title: {tech['title']}\n"
        f"- Provider: {tech['provider']}\n"
        f"- Description: {tech['description']}\n"
        f"- TRL: {tech['trl']}\n"
        f"- Category: {tech['category']} / {tech['sub_category']}"
        for tech in relevant_techs[:12]
    ])
    
    valid_ids = [tech['tech_id'] for tech in relevant_techs[:12]]
    
    prompt = f"""You are an innovation consultant specializing in net-zero technology solutions. 

CLIENT CHALLENGE:
{challenge_input.challenge_description}

CONTEXT:
- Industry: {challenge_input.industry_sector or 'Not specified'}
- Emissions Baseline: {challenge_input.emissions_baseline or 'Not specified'} tCO2e/year
- Target Reduction: {challenge_input.target_reduction or 'Not specified'}%
- Timeline: {challenge_input.timeline_months or 'Not specified'} months
- Budget: {challenge_input.budget_range or 'Not specified'}
- Constraints: {', '.join(challenge_input.constraints) if challenge_input.constraints else 'None specified'}

AVAILABLE TECHNOLOGIES:
{tech_context}

IMPORTANT RULES:
1. Use technology IDs ONLY from this list: {', '.join(valid_ids)}
2. Each solution can combine 3-4 technologies to create synergistic value
3. Explain WHY each technology is essential to the solution
4. The description field should be 4-5 sentences explaining the complete solution concept
5. Focus on innovative combinations that address multiple aspects of the challenge

TASK:
Generate 3 distinct solution concepts. Each solution should:
- Combine 3-4 complementary technologies that work together
- Have a clear, compelling title that captures the solution's essence
- Include a detailed description (4-5 sentences) covering: what the solution does, how technologies integrate, expected outcomes, and key innovation
- Explain the specific role of each technology in the combination
- List 4 concrete benefits (quantify where possible)
- Identify 3-4 realistic integration challenges
- Provide honest feasibility assessment based on TRL levels and complexity

CRITICAL: Output ONLY the JSON object below, with NO explanatory text before or after.

Example structure (use 3-4 technologies per solution):
{{
  "solutions": [
    {{
      "solution_id": 1,
      "title": "Descriptive Solution Name That Captures the Innovation",
      "technology_ids": ["{valid_ids[0] if len(valid_ids) > 0 else '0'}", "{valid_ids[1] if len(valid_ids) > 1 else '1'}", "{valid_ids[2] if len(valid_ids) > 2 else '2'}"],
      "description": "A comprehensive 4-5 sentence description that explains the complete solution concept. This should cover what the solution achieves, how the technologies work together as a system, the expected quantitative impact on emissions reduction, and what makes this combination innovative. Be specific about integration points between technologies and how they create synergistic value beyond using them independently.",
      "how_it_works": "Detailed technical explanation of the integrated system, describing the flow of energy/materials/data between components, operational sequence, control mechanisms, and how each technology enables the others to function more effectively. Include specific technical details about integration points.",
      "technology_roles": {{
        "{valid_ids[0] if len(valid_ids) > 0 else '0'}": "Specific detailed role explaining what this technology contributes and why it's essential",
        "{valid_ids[1] if len(valid_ids) > 1 else '1'}": "Specific detailed role explaining integration with other components",
        "{valid_ids[2] if len(valid_ids) > 2 else '2'}": "Specific detailed role explaining unique value it adds to the system"
      }},
      "benefits": [
        "Quantified emissions reduction: specific percentage or tonnage", 
        "Operational benefit with measurable impact", 
        "Economic benefit with estimated savings or ROI timeframe",
        "Additional strategic or compliance benefit"
      ],
      "integration_considerations": [
        "Technical integration challenge with specific details", 
        "Operational or safety consideration requiring attention",
        "Commercial or regulatory hurdle to address"
      ],
      "feasibility": "High",
      "timeline_estimate": "24-30 months",
      "estimated_cost_range": "High (£8M-£15M)"
    }}
  ]
}}

Now generate 3 innovative solutions following this format exactly."""

    try:
        print("🤖 Calling Ollama...")
        response = ollama.generate(
            model='llama3.1:8b',
            prompt=prompt,
            options={
                'temperature': 0.70,  # ⭐ Slightly higher for more creativity
                'num_predict': 3072,  # ⭐ Increased from 2048 to allow longer responses
                'top_p': 0.9,         # ⭐ Nucleus sampling for better quality
            }
        )
        
        response_text = response['response']
        print(f"📝 LLM response length: {len(response_text)} chars")
        
        # ⭐ Use robust JSON extraction
        try:
            json_str = extract_json_from_text(response_text)
            print(f"✅ Extracted {len(json_str)} char JSON")
        except ValueError as e:
            print(f"❌ JSON extraction failed: {e}")
            print(f"First 500 chars of response:\n{response_text[:500]}")
            raise ValueError(f"Could not extract JSON from LLM response: {e}")
        
        # Parse the extracted JSON
        llm_output = json.loads(json_str)
        
        if 'solutions' not in llm_output:
            raise ValueError("LLM response missing 'solutions' key")
        
        print(f"✅ Parsed {len(llm_output['solutions'])} solutions")
        
        # Convert to Solution objects with validation
        solutions = []
        for sol in llm_output['solutions']:
            tech_matches = []
            
            # ⭐ Log how many technologies the LLM proposed
            print(f"💡 Solution {sol['solution_id']}: {len(sol['technology_ids'])} technologies proposed")
            
            for tech_id in sol['technology_ids']:
                tech = next((t for t in relevant_techs if t['tech_id'] == tech_id), None)
                if tech:
                    tech_matches.append(TechnologyMatch(
                        tech_id=tech['tech_id'],
                        title=tech['title'],
                        provider=tech['provider'],
                        description=tech['description'],
                        trl=tech['trl'],
                        category=tech['category'],
                        sub_category=tech['sub_category'],
                        relevance_score=1.0 - tech['distance'],
                        reasoning=sol['technology_roles'].get(tech_id, "Key component")
                    ))
            
            if tech_matches:
                solutions.append(Solution(
                    solution_id=sol['solution_id'],
                    title=sol['title'],
                    technologies=tech_matches,
                    description=sol['description'],
                    how_it_works=sol['how_it_works'],
                    benefits=sol['benefits'],
                    integration_considerations=sol['integration_considerations'],
                    feasibility=sol['feasibility'],
                    timeline_estimate=sol['timeline_estimate'],
                    estimated_cost_range=sol['estimated_cost_range']
                ))
        
        if len(solutions) == 0:
            raise ValueError("No valid solutions generated")
        
        print(f"✅ Returning {len(solutions)} complete solutions")
        return solutions
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON Parse Error: {e}")
        print(f"Attempted to parse:\n{json_str if 'json_str' in locals() else 'N/A'}")
        raise HTTPException(status_code=500, detail=f"LLM returned invalid JSON: {str(e)}")
    except ValueError as e:
        print(f"❌ Value Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print(f"❌ LLM Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"LLM generation failed: {str(e)}")



@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    ollama_status = "unknown"
    try:
        ollama.list()
        ollama_status = "connected"
    except:
        ollama_status = "disconnected"
    
    return {
        "status": "healthy",
        "ollama": ollama_status,
        "database_loaded": collection is not None and tech_df is not None,
        "technologies_count": len(tech_df) if tech_df is not None else 0
    }


@app.get("/api/database-status")
async def database_status():
    """Get database status"""
    if tech_df is None or collection is None:
        return {
            "loaded": False,
            "message": f"Database not loaded. Check: {DATABASE_FILE_PATH}"
        }
    
    metadata = load_metadata()
    
    return {
        "loaded": True,
        "technology_count": len(tech_df),
        "last_updated": metadata.get('last_updated', 'Unknown'),
        "collection_count": collection.count() if collection else 0
    }


@app.post("/api/generate-solutions", response_model=SolutionResponse)
async def generate_solutions(challenge: ChallengeInput):
    """Generate AI-powered solution concepts"""
    import time
    start_time = time.time()
    
    if collection is None or tech_df is None:
        raise HTTPException(status_code=503, detail="Database not loaded")
    
    try:
        relevant_techs = query_relevant_technologies(
            challenge.challenge_description, 
            n_results=15
        )
        
        solutions = generate_solutions_with_llm(challenge, relevant_techs)
        processing_time = time.time() - start_time
        
        # ⭐ Store for admin review
        submission_id = str(uuid.uuid4())
        pending_solutions[submission_id] = {
            "submission_id": submission_id,
            "challenge": challenge.model_dump(),
            "solutions": [sol.model_dump() for sol in solutions],
            "submitted_at": datetime.now().isoformat(),
            "status": "pending"
        }
        
        print(f"✅ Stored submission {submission_id} for review")
        
        return {
            "solutions": solutions,
            "processing_time": processing_time,
            "technologies_analyzed": len(relevant_techs),
            "submission_id": submission_id
        }
        
    except Exception as e:
        print("=" * 60)
        print("ERROR IN GENERATE SOLUTIONS:")
        traceback.print_exc()
        print("=" * 60)
        raise HTTPException(status_code=500, detail=str(e))

# admin endpoints

@app.get("/api/admin/submissions")
async def get_all_submissions():
    """Get all solution submissions for review"""
    all_submissions = {**pending_solutions, **reviewed_solutions}
    return {
        "total": len(all_submissions),
        "pending": len([s for s in all_submissions.values() if s["status"] == "pending"]),
        "approved": len([s for s in all_submissions.values() if s["status"] == "approved"]),
        "rejected": len([s for s in all_submissions.values() if s["status"] == "rejected"]),
        "submissions": list(all_submissions.values())
    }


@app.get("/api/admin/submissions/pending")
async def get_pending_submissions():
    """Get pending submissions only"""
    return {
        "count": len(pending_solutions),
        "submissions": list(pending_solutions.values())
    }


@app.post("/api/admin/submissions/{submission_id}/review")
async def review_submission(submission_id: str, review: ReviewAction):
    """Review a solution submission"""
    print(f"🔍 Received review request for {submission_id}: {review.action}")
    
    if submission_id not in pending_solutions:
        print(f"❌ Submission {submission_id} not found in pending_solutions")
        raise HTTPException(status_code=404, detail="Submission not found")
    
    submission = pending_solutions[submission_id]
    
    # ⭐ FIX: Convert "approve" to "approved", "reject" to "rejected"
    if review.action == "approve":
        submission["status"] = "approved"
    elif review.action == "reject":
        submission["status"] = "rejected"
    else:
        submission["status"] = review.action
    
    submission["reviewed_at"] = datetime.now().isoformat()
    submission["feedback"] = review.feedback
    
    # Move to reviewed
    reviewed_solutions[submission_id] = submission
    del pending_solutions[submission_id]
    
    print(f"✅ Submission {submission_id} status set to: {submission['status']}")
    print(f"   Pending count: {len(pending_solutions)}")
    print(f"   Reviewed count: {len(reviewed_solutions)}")
    
    return {
        "message": f"Submission {review.action}d successfully",
        "submission": submission
    }



@app.get("/api/admin/submissions/{submission_id}")
async def get_submission_detail(submission_id: str):
    """Get detailed view of a specific submission"""
    submission = pending_solutions.get(submission_id) or reviewed_solutions.get(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission


@app.get("/")
async def root():
    return {
        "message": "NZTC Innovation Co-Pilot API",
        "version": "2.0.0",
        "database_loaded": collection is not None,
        "technologies": len(tech_df) if tech_df is not None else 0
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
