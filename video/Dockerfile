# Umwandlung der Videos für die Mediathek (Kap. 8.15): ffmpeg, Spracherkennung
# (whisper.cpp) und Vorschläge für Zusammenfassung und Kapitel (llama.cpp mit
# Gemma 4 E4B) ohne Netz, schreibgeschützt, als Benutzer 1000 (wie die Anwendung,
# gemeinsamer Arbeitsordner).

# --- whisper.cpp bauen (fester Stand, Commit geprüft) ---
FROM alpine:3.24 AS whisper
ARG WHISPER_VERSION=v1.9.5
ARG WHISPER_COMMIT=d1be6fde11ac6e0407606b4e42fe72d34add8037
RUN apk add --no-cache build-base cmake git
RUN git clone --depth 1 --branch "$WHISPER_VERSION" https://github.com/ggml-org/whisper.cpp.git /src \
	&& test "$(git -C /src rev-parse HEAD)" = "$WHISPER_COMMIT"
# Ohne CPU-Erkennung beim Bauen: läuft auf allen x86-64-Servern mit AVX2 (seit etwa 2013)
RUN cmake -S /src -B /build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
		-DGGML_NATIVE=OFF -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON \
		-DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF \
	&& cmake --build /build -j"$(nproc)" --target whisper-cli \
	&& strip /build/bin/whisper-cli

# --- Sprachmodell (large-v3-turbo, q5_0; Prüfsumme laut whisper.cpp/models/README.md) ---
FROM alpine:3.24 AS modell
ARG MODELL_SHA1=e050f7970618a659205450ad97eb95a18d69c9ee
RUN mkdir /modelle \
	&& wget -q -O /modelle/ggml-large-v3-turbo-q5_0.bin \
		https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin \
	&& echo "$MODELL_SHA1  /modelle/ggml-large-v3-turbo-q5_0.bin" | sha1sum -c -

# --- llama.cpp bauen (fester Stand, Commit geprüft), nur llama-completion ---
FROM alpine:3.24 AS llama
ARG LLAMA_VERSION=v1.0.0
ARG LLAMA_COMMIT=b1b770d90d94cad9e9ea5b993bdbc383a522fb28
RUN apk add --no-cache build-base cmake git linux-headers
RUN git clone --depth 1 --branch "$LLAMA_VERSION" https://github.com/ggml-org/llama.cpp.git /src \
	&& test "$(git -C /src rev-parse HEAD)" = "$LLAMA_COMMIT"
RUN cmake -S /src -B /build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
		-DGGML_NATIVE=OFF -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON \
		-DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_BUILD_SERVER=OFF \
		-DLLAMA_BUILD_APP=OFF -DLLAMA_OPENSSL=OFF -DLLAMA_USE_PREBUILT_UI=OFF \
	&& cmake --build /build -j"$(nproc)" --target llama-completion \
	&& strip /build/bin/llama-completion

# --- Sprachmodell für Vorschläge: Gemma 4 E4B (QAT, Q4_0) von Google, Apache 2.0 ---
# Fester Stand (Commit des Repos) und SHA-256 der Datei
FROM alpine:3.24 AS sprachmodell
ARG LLM_REPO=google/gemma-4-E4B-it-qat-q4_0-gguf
ARG LLM_REVISION
ARG LLM_DATEI
ARG LLM_SHA256
RUN test -n "$LLM_REVISION" && test -n "$LLM_DATEI" && test -n "$LLM_SHA256" \
	&& mkdir /modelle \
	&& wget -q -O /modelle/sprachmodell.gguf \
		"https://huggingface.co/$LLM_REPO/resolve/$LLM_REVISION/$LLM_DATEI" \
	&& echo "$LLM_SHA256  /modelle/sprachmodell.gguf" | sha256sum -c -

FROM alpine:3.24
RUN apk add --no-cache ffmpeg libstdc++ libgomp \
	&& addgroup -g 1000 umwandlung \
	&& adduser -D -H -u 1000 -G umwandlung umwandlung \
	&& mkdir -p /arbeit && chown umwandlung:umwandlung /arbeit && chmod 700 /arbeit
COPY --from=whisper /build/bin/whisper-cli /usr/local/bin/whisper-cli
COPY --from=llama /build/bin/llama-completion /usr/local/bin/llama-completion
COPY --from=modell /modelle /modelle
COPY --from=sprachmodell /modelle/sprachmodell.gguf /modelle/sprachmodell.gguf
COPY vorschlag /usr/local/share/vorschlag
COPY --chmod=0755 umwandeln.sh /usr/local/bin/umwandeln.sh
USER umwandlung
ENV ARBEIT=/arbeit MODELL=/modelle/ggml-large-v3-turbo-q5_0.bin
HEALTHCHECK --interval=60s --timeout=5s CMD test -w /arbeit
ENTRYPOINT ["/usr/local/bin/umwandeln.sh"]
