import os

output = []
for root, dirs, files in os.walk('backend'):
    for file in files:
        if file.endswith('.py'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                if 'EmployeeSalary' in content:
                    output.append(path)

with open('find_salary.txt', 'w') as f:
    f.write('\n'.join(output))
