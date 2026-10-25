var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactAppPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:5173") 
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); 
    });
});
builder.Services.AddControllers();

builder.Services.AddOpenApi();

var app = builder.Build();

app.UseCors("ReactAppPolicy");
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
