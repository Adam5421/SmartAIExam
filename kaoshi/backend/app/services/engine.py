from typing import List
from sqlalchemy.orm import Session
from app import models, crud
import random

class AssemblyEngine:
    def __init__(self, db: Session):
        self.db = db

    def generate_paper(self, rule_config: dict) -> List[models.Question]:
        """
        Generate a list of questions based on the rule configuration.
        Config structure example:
        {
            "total_count": 10,
            "type_distribution": {"single": 5, "multi": 2, "judge": 3},
            "difficulty_distribution": {"1": 0.2, "2": 0.5, "3": 0.3},
            "tags": ["Math"]
        }
        """
        selected_questions = []
        
        # 1. Filter base pool by tags if specified
        # ONLY select questions that are PUBLISHED
        query = self.db.query(models.Question).filter(models.Question.status == 'published')

        # Note: Tag filtering is simplified here. In production, use proper JSON operators or secondary tables.
        # For SQLite JSON, exact match or simple contains is tricky without extensions, 
        # so we fetch and filter in memory for this MVP or assume no tag filter for now.
        
        all_candidates = query.all()
        
        # 2. Process by Question Type
        type_dist = rule_config.get("type_distribution", {})
        
        for q_type, count in type_dist.items():
            # Filter candidates by type
            type_candidates = [q for q in all_candidates if q.q_type == q_type]
            
            if not type_candidates:
                continue
                
            # 3. Apply Difficulty Distribution within this type
            # Calculate target counts for each difficulty
            diff_dist = rule_config.get("difficulty_distribution", {})
            
            questions_for_type = []
            remaining_count = count
            
            # Try to satisfy difficulty requirements
            for diff_level, ratio in diff_dist.items():
                target_count = int(count * ratio)
                if target_count == 0:
                    continue
                    
                diff_candidates = [q for q in type_candidates if str(q.difficulty) == str(diff_level)]
                
                # Select random questions
                selected = random.sample(diff_candidates, min(len(diff_candidates), target_count))
                questions_for_type.extend(selected)
                
                # Remove selected from candidates to avoid duplicates (though diff filter handles this)
                remaining_count -= len(selected)
            
            # 4. Fill remaining with random questions from same type if difficulty constraints couldn't be met
            if remaining_count > 0:
                # Get currently unselected candidates of this type
                current_selected_ids = {q.id for q in questions_for_type}
                remaining_candidates = [q for q in type_candidates if q.id not in current_selected_ids]
                
                fillers = random.sample(remaining_candidates, min(len(remaining_candidates), remaining_count))
                questions_for_type.extend(fillers)
            
            selected_questions.extend(questions_for_type)
            
        return selected_questions
