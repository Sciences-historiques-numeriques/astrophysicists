// NOT IN USE



// Function to send SPARQL query and display results
export function sendSparqlQuery(endpoint, query) {
    // Create a new XMLHttpRequest object
    var xhr = new XMLHttpRequest();

    // Set the query string
    var queryString = `query=${encodeURIComponent(query)}&format=json`;

    // Open the request to the endpoint with the query string
    xhr.open('GET', endpoint + '?' + queryString, true);


    // When the request is loaded
    xhr.onload = function() {
        if (xhr.status === 200) {
            // Parse the JSON response
            var data = JSON.parse(xhr.responseText);
            // Call the function to display the results
            displayResults(data);
        } else {
            console.error('Error fetching data:', xhr.statusText);
        }
    };

    // Send the request
    xhr.send();
}

// Function to display the SPARQL query results
export function displayResults(data) {
    // Get the container for the results
    var resultsContainer = document.getElementById('queryResults');

    // Check if there are results
    if (data.results && data.results.bindings) {
        // Create a table to hold the results
        var table = document.createElement('table');
        var thead = document.createElement('thead');
        var tbody = document.createElement('tbody');
        table.appendChild(thead);
        table.appendChild(tbody);

        // Get the variable names (column headers)
        var variables = data.head.vars;

        // Create the table headers
        var tr = document.createElement('tr');
        variables.forEach(function(variable) {
            var th = document.createElement('th');
            th.textContent = variable;
            tr.appendChild(th);
        });
        thead.appendChild(tr);

        // Create the table rows
        data.results.bindings.forEach(function(binding) {
            var tr = document.createElement('tr');
            variables.forEach(function(variable) {
                var td = document.createElement('td');
                td.textContent = binding[variable]? binding[variable].value : '';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        // Add the table to the results container
        resultsContainer.appendChild(table);
    } else {
        resultsContainer.textContent = 'No results found.';
    }
}