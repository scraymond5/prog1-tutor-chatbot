// ------------------------------------------------------------
// C++ TUTOR CHATBOT
// ------------------------------------------------------------

// Get page elements
const questionBox = document.getElementById("question");
const askButton = document.getElementById("askButton");
const chatBox = document.getElementById("chatBox");


// ------------------------------------------------------------
// CONVERSATION STATE
// ------------------------------------------------------------

let pendingExampleTopic = null;
let pendingClarification = null;


// ------------------------------------------------------------
// KNOWLEDGE BASE
// ------------------------------------------------------------

let topics = [];


// ------------------------------------------------------------
// LOAD C++ CHATBOT KNOWLEDGE BASE
// ------------------------------------------------------------

async function loadKnowledgeBase()
{
    try
    {
        const response = await fetch("knowledge.json");

        if (!response.ok)
        {
            throw new Error(
                "Unable to load knowledge.json. HTTP status: " +
                response.status
            );
        }

        topics = await response.json();

        questionBox.disabled = false;
        askButton.disabled = false;
        questionBox.focus();

        console.log(
            "Knowledge base loaded: " +
            topics.length +
            " topics."
        );
    }
    catch (error)
    {
        console.error("Error loading knowledge base:", error);

        displayMessage(
            "The chatbot knowledge base could not be loaded. " +
            "Make sure knowledge.json is in the same folder as this JavaScript file " +
            "and that the website is being run through a web server.",
            "bot-message"
        );
    }
}


// Prevent questions from being submitted before the JSON file is ready.
questionBox.disabled = true;
askButton.disabled = true;

loadKnowledgeBase();


// ------------------------------------------------------------
// EVENT LISTENERS
// ------------------------------------------------------------

askButton.addEventListener("click", handleQuestion);

questionBox.addEventListener("keydown", function(event)
{
    if (event.key === "Enter")
    {
        handleQuestion();
    }
});


// ------------------------------------------------------------
// HANDLE USER QUESTION
// ------------------------------------------------------------

function handleQuestion()
{
    const question = questionBox.value.trim();

    if (question === "")
    {
        return;
    }

    displayMessage(question, "user-message");

    questionBox.value = "";

    const response = getResponse(question);

    displayMessage(response, "bot-message");
}


// ------------------------------------------------------------
// GET CHATBOT RESPONSE
// ------------------------------------------------------------

function getResponse(question)
{
    const normalizedQuestion = normalizeText(question);


    // --------------------------------------------------------
    // HANDLE YES / NO RESPONSE FOR EXAMPLES
    // --------------------------------------------------------

    if (pendingExampleTopic !== null)
    {
        if (normalizedQuestion === "yes" ||
            normalizedQuestion === "y")
        {
            const topic = pendingExampleTopic;

            pendingExampleTopic = null;

            return formatExamples(topic);
        }

        if (normalizedQuestion === "no" ||
            normalizedQuestion === "n")
        {
            pendingExampleTopic = null;

            return "Okay. What would you like to learn about next?";
        }

        // The user asked something else instead of answering yes/no.
        pendingExampleTopic = null;
    }


    // --------------------------------------------------------
    // HANDLE CLARIFICATION
    // --------------------------------------------------------

    if (pendingClarification !== null)
    {
        const matchedTopic =
            findClarificationTopic(
                normalizedQuestion,
                pendingClarification
            );

        if (matchedTopic !== null)
        {
            pendingClarification = null;

            return formatRequestedInformation(
                matchedTopic,
                question
            );
        }

        // The response did not identify one of the choices.
        pendingClarification = null;
    }


    // --------------------------------------------------------
    // FIND MATCHING TOPICS
    // --------------------------------------------------------

    const matches = findMatchingTopics(normalizedQuestion);

    if (matches.length === 0)
    {
        return "I'm sorry, I don't have information about that topic.";
    }


    // --------------------------------------------------------
    // ONE MATCH
    // --------------------------------------------------------

    if (matches.length === 1)
    {
        return formatRequestedInformation(
            matches[0],
            question
        );
    }


    // --------------------------------------------------------
    // MULTIPLE MATCHES
    // --------------------------------------------------------

    const bestMatches = findBestMatches(
        matches,
        normalizedQuestion
    );

    if (bestMatches.length === 1)
    {
        return formatRequestedInformation(
            bestMatches[0],
            question
        );
    }


    // --------------------------------------------------------
    // ASK USER TO CLARIFY
    // --------------------------------------------------------

    pendingClarification = bestMatches;

    return formatClarification(bestMatches);
}


// ------------------------------------------------------------
// NORMALIZE TEXT
// ------------------------------------------------------------

function normalizeText(text)
{
    return text
        .toLowerCase()
        .replace(/[?.,!;:]/g, "")
        .trim();
}


// ------------------------------------------------------------
// FIND MATCHING TOPICS
// ------------------------------------------------------------

function findMatchingTopics(question)
{
    const matches = [];

    for (const topic of topics)
    {
        for (const keyword of topic.keywords)
        {
            const normalizedKeyword =
                normalizeText(keyword);

            if (question.includes(normalizedKeyword))
            {
                matches.push(topic);
                break;
            }
        }
    }

    return matches;
}


// ------------------------------------------------------------
// FIND BEST MATCHES
// ------------------------------------------------------------

function findBestMatches(matches, question)
{
    let highestScore = 0;
    let bestMatches = [];

    for (const topic of matches)
    {
        let score = 0;

        for (const keyword of topic.keywords)
        {
            const normalizedKeyword =
                normalizeText(keyword);

            if (question.includes(normalizedKeyword))
            {
                if (normalizedKeyword.length > score)
                {
                    score = normalizedKeyword.length;
                }
            }
        }

        if (score > highestScore)
        {
            highestScore = score;
            bestMatches = [topic];
        }
        else if (score === highestScore)
        {
            bestMatches.push(topic);
        }
    }

    return bestMatches;
}


// ------------------------------------------------------------
// FIND TOPIC FROM CLARIFICATION
// ------------------------------------------------------------

function findClarificationTopic(question, choices)
{
    for (const topic of choices)
    {
        const normalizedTopic =
            normalizeText(topic.topic);

        if (question.includes(normalizedTopic))
        {
            return topic;
        }

        for (const keyword of topic.keywords)
        {
            const normalizedKeyword =
                normalizeText(keyword);

            if (question.includes(normalizedKeyword))
            {
                return topic;
            }
        }
    }

    return null;
}


// ------------------------------------------------------------
// FORMAT CLARIFICATION
// ------------------------------------------------------------

function formatClarification(matches)
{
    let response =
        "I found more than one topic that may match your question." +
        "\n\nWhich topic did you mean?";

    for (const topic of matches)
    {
        response +=
            "\n- " +
            topic.topic;
    }

    return response;
}


// ------------------------------------------------------------
// FORMAT REQUESTED INFORMATION
// ------------------------------------------------------------

function formatRequestedInformation(topic, question)
{
    const normalizedQuestion =
        normalizeText(question);


    // --------------------------------------------------------
    // RELATED TOPICS ONLY
    // --------------------------------------------------------

    if (normalizedQuestion.includes("related"))
    {
        return formatRelatedTopics(topic, true);
    }


    // --------------------------------------------------------
    // EXAMPLES ONLY
    // --------------------------------------------------------

    if (normalizedQuestion.includes("example"))
    {
        return formatExamples(topic);
    }


    // --------------------------------------------------------
    // SYNTAX ONLY
    // --------------------------------------------------------

    if (normalizedQuestion.includes("syntax"))
    {
        return formatSyntax(topic);
    }


    // --------------------------------------------------------
    // DEFAULT RESPONSE
    // --------------------------------------------------------

    if (topic.examples && topic.examples.length > 0)
    {
        pendingExampleTopic = topic;
    }
    else
    {
        pendingExampleTopic = null;
    }

    return formatDescription(topic);
}


// ------------------------------------------------------------
// FORMAT DESCRIPTION
// ------------------------------------------------------------

function formatDescription(topic)
{
    let response =
        topic.topic +
        "\n\n" +
        topic.description;

    if (topic.syntax)
    {
        response +=
            "\n\nSyntax:\n" +
            topic.syntax;
    }

    response +=
        "\n\n" +
        formatRelatedTopics(topic, false);

    if (topic.examples &&
        topic.examples.length > 0)
    {
        response +=
            "\n\nWould you like to see examples? Enter yes or no.";
    }

    return response;
}


// ------------------------------------------------------------
// FORMAT SYNTAX
// ------------------------------------------------------------

function formatSyntax(topic)
{
    if (!topic.syntax)
    {
        return topic.topic +
               " does not have syntax associated with this topic.";
    }

    return topic.topic +
           " Syntax:\n\n" +
           topic.syntax;
}


// ------------------------------------------------------------
// FORMAT EXAMPLES
// ------------------------------------------------------------

function formatExamples(topic)
{
    if (!topic.examples ||
        topic.examples.length === 0)
    {
        return "There are no examples for " +
               topic.topic +
               ".";
    }

    let response =
        topic.topic +
        " Examples:\n";

    for (let i = 0;
         i < topic.examples.length;
         i++)
    {
        response +=
            "\nExample " +
            (i + 1) +
            ":\n";

        response += topic.examples[i];

        if (i < topic.examples.length - 1)
        {
            response += "\n";
        }
    }

    return response;
}


// ------------------------------------------------------------
// FORMAT RELATED TOPICS
// ------------------------------------------------------------

function formatRelatedTopics(topic, heading)
{
    if (!topic.relatedTopics ||
        topic.relatedTopics.length === 0)
    {
        return "There are no related topics.";
    }

    let response = "";

    if (heading)
    {
        response =
            topic.topic +
            " Related Topics:\n\n";
    }
    else
    {
        response = "Related Topics:\n";
    }

    for (const relatedTopic of topic.relatedTopics)
    {
        response +=
            "\n- " +
            relatedTopic;
    }

    return response;
}


// ------------------------------------------------------------
// DISPLAY MESSAGE
// ------------------------------------------------------------

function displayMessage(message, className)
{
    const messageElement =
        document.createElement("div");

    messageElement.classList.add(className);

    messageElement.textContent = message;

    chatBox.appendChild(messageElement);

    chatBox.scrollTop =
        chatBox.scrollHeight;
}