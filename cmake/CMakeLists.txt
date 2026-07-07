cmake_minimum_required(VERSION 3.20)

project(jsbsim_wasm LANGUAGES CXX)

# Find JSBSim source
if(NOT JSBSIM_SOURCE_DIR)
  # Default to vendor/jsbsim within the project
  get_filename_component(PARENT_DIR ${CMAKE_CURRENT_LIST_DIR} DIRECTORY)
  set(JSBSIM_SOURCE_DIR ${PARENT_DIR}/vendor/jsbsim)
endif()

if(NOT EXISTS "${JSBSIM_SOURCE_DIR}/CMakeLists.txt")
  message(FATAL_ERROR "JSBSim source not found at ${JSBSIM_SOURCE_DIR}")
endif()

# Build JSBSim library (static)
set(BUILD_DOCS OFF CACHE BOOL "" FORCE)
set(BUILD_PYTHON_MODULE OFF CACHE BOOL "" FORCE)
set(BUILD_JULIA_PACKAGE OFF CACHE BOOL "" FORCE)
set(BUILD_MATLAB_SFUNCTION OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(SYSTEM_EXPAT OFF CACHE BOOL "" FORCE)

# Add JSBSim as subdirectory
add_subdirectory(${JSBSIM_SOURCE_DIR} ${CMAKE_BINARY_DIR}/jsbsim EXCLUDE_FROM_ALL)

# Check for generated bindings
set(BINDINGS_FILE "${CMAKE_CURRENT_LIST_DIR}/../generated/FGFDMExecBindings.cpp")
if(NOT EXISTS ${BINDINGS_FILE})
  message(FATAL_ERROR "Generated bindings not found. Run: npm run generate:bindings")
endif()

# Create WASM executable with embind
add_executable(jsbsim_wasm ${BINDINGS_FILE})

set_target_properties(jsbsim_wasm PROPERTIES
  OUTPUT_NAME "jsbsim_wasm"
  SUFFIX ".mjs"
)

target_compile_features(jsbsim_wasm PRIVATE cxx_std_17)
target_compile_options(jsbsim_wasm PRIVATE -fexceptions)

target_include_directories(jsbsim_wasm PRIVATE
  ${JSBSIM_SOURCE_DIR}/src
  ${JSBSIM_SOURCE_DIR}/src/simgear
)

target_link_libraries(jsbsim_wasm PRIVATE libJSBSim)

# Emscripten-specific link options
target_link_options(jsbsim_wasm PRIVATE
  --bind                          # Enable embind
  -O3                             # Optimize
  -sMODULARIZE=1                  # ES module output
  -sEXPORT_ES6=1                  # ES6 module format
  -sEXPORT_NAME=JSBSimWasmModule
  -sENVIRONMENT=web,worker,node   # Target environments
  -sFILESYSTEM=1                  # Enable filesystem
  -sALLOW_MEMORY_GROWTH=1
  -sNO_DISABLE_EXCEPTION_CATCHING
  -sWASM_BIGINT=1
  "-sEXPORTED_RUNTIME_METHODS=['FS']"
  "-sFORCE_FILESYSTEM=1"
)

# Copy WASM file to public directory after build
add_custom_command(TARGET jsbsim_wasm POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy
    ${CMAKE_BINARY_DIR}/jsbsim_wasm.wasm
    ${CMAKE_CURRENT_LIST_DIR}/../public/wasm/jsbsim_wasm.wasm
  COMMAND ${CMAKE_COMMAND} -E copy
    ${CMAKE_BINARY_DIR}/jsbsim_wasm.mjs
    ${CMAKE_CURRENT_LIST_DIR}/../public/wasm/jsbsim_wasm.mjs
  COMMENT "Copying WASM files to public directory"
)
