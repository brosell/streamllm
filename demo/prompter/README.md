# @barosell/prompter

## Overview

`@barosell/prompter` is a tool designed to pipe data for prompts to Language Learning Models (LLMs). It's useful for sending prompt data from various sources (like files or standard input) to LLMs such as OpenAI's models.

## Installation

Ensure you have Node.js installed. You can install this package by running:

```bash
npm install @barosell/prompter
```

## Usage

`prompter` can be used directly from the command line:

```bash
prompter --prompt=<promptText> [file]
```

### Options:

- `--prompt` or `-p`: **(Required)** The prompt to send to the model. You can prepend `@` to use a prompt from a file. For example, `--prompt=@path/to/file.txt`.

- `--quiet` or `-q`: Suppress printing the input.

### Arguments:

- `file`: The file to read from. Use `-` or omit to use standard input. If no file is specified, `prompter` reads from stdin.

### Example

To use `prompter` with a file and display the output:
```bash
prompter --prompt=@prompt.txt input.txt
```

To suppress the input data output:
```bash
prompter --prompt="Hello, what's the weather?" --quiet
```

Create a commit message:
```bash
git diff --cached | prompter -p="write a concise commit message and summary of changes for this diff. no headers. no markdown." -q
```

## License

This project is licensed under the MIT License.

---

Using `prompter`, you can efficiently forward data for processing by AI models, making it easy to automate interactions with LLMs.


