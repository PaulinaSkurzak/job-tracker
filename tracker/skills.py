"""The vocabulary the resume matcher knows about.

Why a curated list instead of "every word that appears in the job description"?
Counting raw words surfaces noise ("team", "experience", "strong") as missing keywords.
A skills vocabulary gives precise, explainable results. The tradeoff: a skill that is not in
this list is invisible to the matcher, so extend the list as you meet new terms.
"""

SKILLS = [
    # languages
    "Python", "SQL", "R", "Java", "JavaScript", "TypeScript", "C++", "C#", "Scala", "MATLAB", "Bash",
    "HTML", "CSS", "Golang", "Rust", "PHP", "Swift", "Kotlin",
    # machine learning and statistics
    "machine learning", "deep learning", "neural network", "computer vision", "NLP",
    "reinforcement learning", "statistics", "statistical analysis", "regression", "classification",
    "clustering", "time series", "forecasting", "anomaly detection", "feature engineering",
    "A/B testing", "hypothesis testing", "Bayesian", "random forest", "XGBoost", "transformer", "LLM",
    "RAG", "generative AI", "prompt engineering", "fine-tuning", "MLOps", "model evaluation",
    "data mining", "predictive modeling", "optimization", "recommendation system", "image processing",
    "OpenCV", "imputation", "experimentation",
    # libraries and frameworks
    "pandas", "NumPy", "SciPy", "scikit-learn", "PyTorch", "TensorFlow", "Keras", "Hugging Face",
    "LangChain", "Matplotlib", "Seaborn", "Plotly", "Jupyter", "Spark", "PySpark", "Hadoop", "Airflow",
    "dbt", "Kafka", "Flink",
    # data engineering and databases
    "ETL", "data pipeline", "data warehouse", "data modeling", "data engineering", "data analysis",
    "data visualization", "data cleaning", "data quality", "data governance", "big data", "streaming",
    "batch processing", "Snowflake", "Redshift", "BigQuery", "Databricks", "MongoDB", "Redis",
    "Elasticsearch", "NoSQL", "PostgreSQL", "MySQL", "SQLite", "Oracle", "SQL Server",
    # cloud and software engineering
    "AWS", "Azure", "GCP", "Azure OpenAI", "Docker", "Kubernetes", "Terraform", "CI/CD", "Git", "GitHub",
    "Linux", "REST API", "API", "microservice", "FastAPI", "Flask", "Django", "nginx", "React",
    "Node.js", "GraphQL", "Agile", "Scrum", "unit testing", "pytest", "Jira",
    # analytics tools
    "Tableau", "Power BI", "Looker", "Excel", "R Shiny", "Qlik",
    # healthcare and life sciences
    "healthcare", "clinical", "EHR", "HIPAA", "FHIR", "HL7", "epidemiology", "public health", "genomics",
    "bioinformatics", "biostatistics", "medical imaging", "clinical trial", "life sciences", "pharma",
    "wearable", "claims data", "DICOM",
]

# These are ordinary English words as well, so they only count when capitalized as written
# ("Spark" the tool, not "spark" curiosity; "R" the language, not a stray letter).
CASE_SENSITIVE = {"R", "Excel", "Spark", "Oracle", "Swift", "Rust", "Scala"}

# Alternative spellings, mapped to the skill name above. Keys are lowercase, with hyphens and
# underscores written as spaces (the matcher normalizes text the same way).
ALIASES = {
    "sklearn": "scikit-learn",
    "scikit learn": "scikit-learn",
    "postgres": "PostgreSQL",
    "js": "JavaScript",
    "ts": "TypeScript",
    "ml": "machine learning",
    "k8s": "Kubernetes",
    "amazon web services": "AWS",
    "google cloud": "GCP",
    "ci cd": "CI/CD",
    "cicd": "CI/CD",
    "elt": "ETL",
    "restful": "REST API",
    "powerbi": "Power BI",
    "natural language processing": "NLP",
    "large language model": "LLM",
    "data analytics": "data analysis",
    "gen ai": "generative AI",
    "genai": "generative AI",
    "neural net": "neural network",
    "ab testing": "A/B testing",
    "a b testing": "A/B testing",
    "mongo": "MongoDB",
    "torch": "PyTorch",
    "huggingface": "Hugging Face",
    "nodejs": "Node.js",
    "reactjs": "React",
    "react.js": "React",
}
