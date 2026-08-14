// Get references to the HTML elements.
const questionBox = document.getElementById("question");
const askButton = document.getElementById("askButton");
const conversation = document.getElementById("conversation");

// Stores the topic when the chatbot is waiting for a yes/no response.
let pendingExampleTopic = null;

// Stores topics when one keyword matches multiple topics.
let pendingTopicMatches = null;

// Stores whether the user requested examples, syntax, or related topics
// before the chatbot asked them to choose a topic.
let pendingTopicRequest = null;


// ------------------------------------------------------------
// C++ CHATBOT KNOWLEDGE BASE
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
            throw new Error("Could not load knowledge base.");
        }

        topics = await response.json();

        console.log("Knowledge base loaded.");
    }
    catch (error)
    {
        console.error("Error loading knowledge base:", error);
    }
}

loadKnowledgeBase();


// ------------------------------------------------------------
// REQUEST KEYWORDS
// ------------------------------------------------------------

const exampleKeywords =
[
    "example",
    "examples",
    "sample",
    "show me",
    "demonstrate"
];

const syntaxKeywords =
[
    "syntax",
    "show syntax",
    "show me the syntax",
    "what is the syntax",
    "syntax for",
    "how do i declare",
    "how to declare"
];

const relatedKeywords =
[
    "related",
    "related topic",
    "related topics",
    "learn next",
    "what next",
    "after this",
    "other topics"
];

const yesKeywords =
[
    "yes",
    "yeah",
    "yep",
    "sure",
    "okay",
    "ok",
    "please",
    "yes please"
];

const noKeywords =
[
    "no",
    "nope",
    "not now",
    "no thanks",
    "no thank you"
];


// ------------------------------------------------------------
// EVENT LISTENERS
// ------------------------------------------------------------

askButton.addEventListener("click", processQuestion);

questionBox.addEventListener("keydown", function(event)
{
    if (event.key === "Enter")
    {
        processQuestion();
    }
});


// ------------------------------------------------------------
// MAIN CHATBOT FUNCTIONS
// ------------------------------------------------------------

function processQuestion()
{
    const originalQuestion = questionBox.value.trim();

    if (originalQuestion === "")
    {
        return;
    }

    displayMessage(originalQuestion, "user-message");

    const normalizedQuestion = normalizeText(originalQuestion);
    const answer = findAnswer(normalizedQuestion);

    displayMessage(answer, "bot-message");

    questionBox.value = "";
    questionBox.focus();
}


function findAnswer(question)
{
    /*
        If the chatbot previously found multiple matching topics,
        check whether the user selected one of those topics.
    */
    if (pendingTopicMatches !== null)
    {
        const selectedTopic = findPendingTopic(question);

        if (selectedTopic !== null)
        {
            const request = pendingTopicRequest;

            pendingTopicMatches = null;
            pendingTopicRequest = null;

            return formatRequestedInformation(selectedTopic, request);
        }

        /*
            The user entered a new topic instead of selecting one of
            the clarification choices. Clear the pending clarification
            and continue processing the question normally.
        */
        pendingTopicMatches = null;
        pendingTopicRequest = null;
    }

    /*
        If the chatbot previously asked whether the user wanted
        examples, first check for an exact yes or no response.
    */
    if (pendingExampleTopic !== null)
    {
        if (isExactResponse(question, yesKeywords))
        {
            const topic = pendingExampleTopic;
            pendingExampleTopic = null;

            return formatExamples(topic);
        }

        if (isExactResponse(question, noKeywords))
        {
            pendingExampleTopic = null;

            return "Okay. What other C++ topic would you like to explore?";
        }

        /*
            The user entered a new topic instead of answering yes or no.
        */
        pendingExampleTopic = null;
    }

    /*
        Determine what type of information the student requested.
    */
    const request =
    {
        wantsExample: containsAny(question, exampleKeywords),
        wantsSyntax: containsAny(question, syntaxKeywords),
        wantsRelated: containsAny(question, relatedKeywords)
    };

    const topicMatches = findTopics(question);

    if (topicMatches.length === 0)
    {
        return "I do not have an answer for that C++ topic yet. " +
               "Try asking about variables, data types, constants, input and output, " +
               "if statements, loops, functions, arrays, vectors, structures, " +
               "classes, objects, constructors, references, or pointers.";
    }

    /*
        More than one topic contains the most-specific matching keyword.
    */
    if (topicMatches.length > 1)
    {
        pendingTopicMatches = topicMatches;
        pendingTopicRequest = request;

        return formatTopicChoices(topicMatches);
    }

    return formatRequestedInformation(topicMatches[0], request);
}


// ------------------------------------------------------------
// TOPIC SEARCHING
// ------------------------------------------------------------

function findTopics(question)
{
    /*
        Search all keywords and keep the topics associated with the
        longest matching keyword.

        This allows a shared keyword, such as open(), to return both
        ifstream and ofstream while preventing shorter, less-specific
        keywords from creating unnecessary matches.
    */
    const keywordEntries = [];

    for (const topic of topics)
    {
        for (const keyword of topic.keywords)
        {
            keywordEntries.push(
                {
                    keyword: keyword,
                    topic: topic
                }
            );
        }
    }

    let longestMatchLength = 0;
    let matchingTopics = [];

    for (const entry of keywordEntries)
    {
        if (containsWholeKeyword(question, entry.keyword))
        {
            const keywordLength = entry.keyword.length;

            /*
                A longer keyword is more specific, so discard matches
                made by shorter keywords.
            */
            if (keywordLength > longestMatchLength)
            {
                longestMatchLength = keywordLength;
                matchingTopics = [entry.topic];
            }

            /*
                Keep topics that match another keyword of the same
                maximum length.
            */
            else if (keywordLength === longestMatchLength)
            {
                if (!matchingTopics.includes(entry.topic))
                {
                    matchingTopics.push(entry.topic);
                }
            }
        }
    }

    return matchingTopics;
}


function formatTopicChoices(topicMatches)
{
    let response =
        "I found multiple topics that match your question. " +
        "Please enter the topic you intended:\n";

    for (const topic of topicMatches)
    {
        response += "\n• " + topic.topic;
    }

    return response;
}


function findPendingTopic(question)
{
    for (const topic of pendingTopicMatches)
    {
        /*
            Allow the student to select the topic by entering its
            exact topic name.
        */
        if (question === normalizeText(topic.topic))
        {
            return topic;
        }

        /*
            Also allow a keyword that uniquely identifies one of the
            pending topics.
        */
        for (const keyword of topic.keywords)
        {
            if (containsWholeKeyword(question, keyword))
            {
                return topic;
            }
        }
    }

    return null;
}


function formatRequestedInformation(topic, request)
{
    if (request.wantsExample)
    {
        return formatExamples(topic);
    }

    if (request.wantsSyntax)
    {
        return formatSyntax(topic);
    }

    if (request.wantsRelated)
    {
        return formatRelatedTopics(topic);
    }

    pendingExampleTopic = topic;

    return formatDescription(topic);
}


function containsWholeKeyword(question, keyword)
{
    const escapedKeyword = keyword.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

    const pattern = new RegExp(
        "(^|\\s)" + escapedKeyword + "(?=\\s|$)",
        "i"
    );

    return pattern.test(question);
}


// ------------------------------------------------------------
// KEYWORD HELPERS
// ------------------------------------------------------------

function containsAny(question, keywords)
{
    for (const keyword of keywords)
    {
        if (question.includes(keyword))
        {
            return true;
        }
    }

    return false;
}


function isExactResponse(question, responses)
{
    const cleanedQuestion = question.trim();

    for (const response of responses)
    {
        if (cleanedQuestion === response)
        {
            return true;
        }
    }

    return false;
}


// ------------------------------------------------------------
// RESPONSE FORMATTING
// ------------------------------------------------------------

function formatDescription(topic)
{
    let response =
        topic.topic +
        "\n\n" +
        topic.description +
        "\n\nSyntax:\n" +
        topic.syntax;

    response += "\n\n" + formatRelatedTopics(topic, false);

    response +=
        "\n\nWould you like to see examples? Enter yes or no.";

    return response;
}


function formatSyntax(topic)
{
    return topic.topic +
           " Syntax:\n\n" +
           topic.syntax;
}


function formatExamples(topic)
{
    let response = topic.topic + " Examples:\n";

    for (let i = 0; i < topic.examples.length; i++)
    {
        response += "\nExample " + (i + 1) + ":\n";
        response += topic.examples[i];

        if (i < topic.examples.length - 1)
        {
            response += "\n";
        }
    }

    return response;
}


function formatRelatedTopics(topic, includeTopicName = true)
{
    if (!topic.relatedTopics || topic.relatedTopics.length === 0)
    {
        return "No related topics are currently available.";
    }

    let response;

    if (includeTopicName)
    {
        response = topic.topic + " Related Topics:\n";
    }
    else
    {
        response = "Related Topics:\n";
    }

    for (const relatedTopic of topic.relatedTopics)
    {
        response += "\n• " + relatedTopic;
    }

    return response;
}


// ------------------------------------------------------------
// INPUT AND DISPLAY HELPERS
// ------------------------------------------------------------

function normalizeText(text)
{
    return text
        .toLowerCase()
        .replace(/[?!.,;:]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function displayMessage(message, className)
{
    const messageElement = document.createElement("div");

    messageElement.className = className;
    messageElement.textContent = message;

    conversation.appendChild(messageElement);

    conversation.scrollTop = conversation.scrollHeight;
}