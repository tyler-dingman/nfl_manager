CREATE TABLE app_editorial_scheduler(id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT NOT NULL,action TEXT NOT NULL,batch TEXT);
