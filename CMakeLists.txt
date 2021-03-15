# mostly based on https://github.com/almoghamdani/audify

cmake_minimum_required(VERSION 3.1)
project(wormhole)

IF (WIN32)
    # Change runtime library to MD
    set(CMAKE_CXX_FLAGS_RELEASE "/MD")
    set(CMAKE_CXX_FLAGS_DEBUG "/MDd")

    # Ignore all C++17 deprecation warnings on windows and unsafe warnings
    add_definitions(-D_SILENCE_ALL_CXX17_DEPRECATION_WARNINGS)
    add_definitions(-D_CRT_SECURE_NO_WARNINGS)
ENDIF()

# Use install RPATH
IF (UNIX)
    set(CMAKE_SKIP_BUILD_RPATH FALSE)
    set(CMAKE_BUILD_WITH_INSTALL_RPATH TRUE)
    set(CMAKE_INSTALL_RPATH_USE_LINK_PATH FALSE)
    set(CMAKE_INSTALL_NAME_DIR "@rpath/")
ENDIF()

# Set RPATH as origin in Linux
IF (UNIX AND NOT APPLE)
    set(CMAKE_INSTALL_RPATH "$ORIGIN")
ENDIF()

# Use @loader_path as RPATH in macOS
IF (APPLE)
    set(CMAKE_MACOSX_RPATH TRUE)
    set(CMAKE_INSTALL_RPATH "@loader_path")
ENDIF()

# Compile RtAudio
# Note: Considering the size of output package, ASIO and DirectSound API
# should not be built, just as the default rtaudio setting
set(RTAUDIO_BUILD_TESTING OFF)
add_subdirectory(vendor/rtaudio rtaudio)

# include all third party directories
include_directories(vendor/rtaudio)
include_directories(vendor/tensorflow)

# Set C++17 standard
set(CMAKE_CXX_STANDARD 17)

# Get all the cpp files
file(GLOB_RECURSE SOURCES "wormhole/*.cpp" "wormhole/*.h")

# Add wormhole as a library
add_library(${PROJECT_NAME} SHARED ${SOURCES} ${CMAKE_JS_SRC})

# Remove lib prefix + add node suffix
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")

# Essential include files to build a node addon,
# You should add this line in every CMake.js based project
target_include_directories(${PROJECT_NAME} PRIVATE ${CMAKE_JS_INC})

# Include N-API wrappers
execute_process(COMMAND node -p "require('node-addon-api').include"
        WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
        OUTPUT_VARIABLE NODE_ADDON_API_DIR
        )
string(REPLACE "\n" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})
string(REPLACE "\"" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})
target_include_directories(${PROJECT_NAME} PRIVATE ${NODE_ADDON_API_DIR})

# Compile the library
target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB} rtaudio ${CMAKE_SOURCE_DIR}/lib/test/libtensorflowlite_c.so)

# Copy libtensorflowlite_c inside build
file(COPY ${CMAKE_SOURCE_DIR}/lib/test/libtensorflowlite_c.so DESTINATION ${CMAKE_CURRENT_BINARY_DIR}/${CMAKE_BUILD_TYPE})