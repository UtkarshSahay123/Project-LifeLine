**workflow for supply chain, resource and emergency optimization**



1. make the frontend and backend , for the backend use PostgreSQL and springboot .
2. make a separate place where all the customers can check for the resources available near them as well as everywhere around, but their search result would be according to their location, i.e. closest location resources should be shown first.



**User need section:**

1. and for the ambulance services that nearby ambulances should be visible and if the customer needs to go to any nearby location then Dijkstra's algorithm should be used.
2. in this section user should be able to get the information about all kind of hospital or any kind of necessary resources that user need.
3. for this do one thing when the user search for anykind of resources, it should be first search check it's indexing database and if the backend won't able to get the information from there it should retrive it from online and then give it to the user and the same information should be stored in my index database so that if same kind of data if again asked by the user then it can retrive it from there reducing the searching time.
4. and in the google maps which is going to be integrated here nearby hospitals and ambulances should be visible with small legends , and rest other resources like medicine, oxygen tank and anyother thing when searched for then can be retrived. 
5. design a chatbot name it as "Pranrakshak" it should be able to give the answer to all the questions asked by the users and make sure that confidential data won't be get leaked by the bot , this bot should have access to our indexing database and google it for rest of the information if needed but first it should be able to search it's own database for the answers
6. and use a cache memory with the expiration policy of 1 week , so that frequently used data can be stored over there which reduced the website loading time , but make sure that it won't expose user data.





**Administration signup/ login page:**

1. Here during signup ask whether u are doing signup as an admin or as an employee , when the user signups as an admin then ask for the necessary details , like his first name , last name , and an organization code should be created when an admin creates the account and this  same code should be used by the organization so that they can be directly added under this admin.



2\. make another signup option enabling a sub organization under the admin to register their organization , here they need to put in their all the details of the organization like , 

A hospital registers in this admin organization with the same joining code and that hospitals needs to register all the supplies it holds so that government can see their live resources and can work accordingly.



and make a separate joining code for this organization so that when an employee uses it then it automatically get's added in this organization. no need for manual entry.



so the admin workflow should be like:

admin makes the account and should be able to see the complete organization resources and their complete details under them.

now suborganization registered under the admin should also generate their joining code which allows the user to join this org. which indirectly registers him under the admin portal.



3\. now make a place for the employee joining place where they need to enter their designation , joining code, empid and other necessary details. and final approval should be done by the organization under which it is getting registered to. 





**Final workflow :**

Now the user's need center should have be able to see the necessary supply details when they search for it from the registered details by these organization.

But make sure that user should not have access to these data, and the Chat bot should also have access to these data using which it can answer the query of the user .












